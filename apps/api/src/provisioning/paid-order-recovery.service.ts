import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderStatus, Prisma, prisma } from "@gch/database";
import { AuditService } from "../audit/audit.service";

const MINIMUM_AGE_MS = 5 * 60 * 1000;
const REVIEW_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

interface RecoveryCandidate {
  id: string;
  orgId: string;
  updatedAt: Date;
}

/**
 * Discovers orders whose in-process order.paid notification may have been lost.
 * A PAID row is only a local observation; it is NOT proof of a qualifying
 * Stripe payment. Until payment eligibility, product mapping and the provider
 * contract are approved, recovery stops at an operator-visible review record.
 * This scheduled path never emits order.paid, calls a provider, or grants access.
 */
@Injectable()
export class PaidOrderRecoveryService {
  private readonly logger = new Logger(PaidOrderRecoveryService.name);

  constructor(private readonly audit: AuditService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async discoverStrandedOrders(now = new Date()): Promise<number> {
    const candidates = await prisma.order.findMany({
      where: {
        status: OrderStatus.PAID,
        stripePaymentId: { not: null },
        providerService: { is: null },
        updatedAt: { lt: new Date(now.getTime() - MINIMUM_AGE_MS) },
      },
      select: { id: true, orgId: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: BATCH_SIZE,
    });

    let recorded = 0;
    for (const candidate of candidates) {
      if (await this.recordForReview(candidate, now)) recorded++;
    }
    return recorded;
  }

  private async recordForReview(candidate: RecoveryCandidate, now: Date): Promise<boolean> {
    const key = createHash("sha256")
      .update(`order:${candidate.id}:paid-recovery-review:v1`)
      .digest("hex");
    try {
      await prisma.$transaction(async (tx) => {
        // Recheck under the transaction: a concurrent listener may have begun
        // provisioning after the discovery query. No provider work is claimed.
        const current = await tx.order.findUnique({
          where: { id: candidate.id },
          select: { status: true, orgId: true, stripePaymentId: true, providerService: { select: { id: true } } },
        });
        if (
          !current ||
          current.status !== OrderStatus.PAID ||
          current.orgId !== candidate.orgId ||
          !current.stripePaymentId ||
          current.providerService
        ) return;

        // The unique key is the concurrency guard. If the transaction fails,
        // neither the marker nor audit is committed, so the next sweep retries.
        await tx.idempotencyRecord.create({
          data: {
            key,
            result: { state: "requires_operator_review", reason: "paid_order_without_provider_service" },
            expiresAt: new Date(now.getTime() + REVIEW_RETENTION_MS),
          },
        });
        await this.audit.logAction({
          actor: "system:paid-order-recovery",
          action: "order.recovery_review_required",
          targetType: "Order",
          targetId: candidate.id,
          metadata: {
            orgId: candidate.orgId,
            reason: "paid_order_without_provider_service",
            paymentVerified: false,
            fulfillmentVerified: false,
          },
        }, tx);
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      // No raw provider or payment error/body is logged.
      this.logger.error(`Recovery review recording failed for order ${candidate.id}`);
      throw error;
    }
  }
}
