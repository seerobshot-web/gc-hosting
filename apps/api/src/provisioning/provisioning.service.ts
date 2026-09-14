import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { prisma } from "@gch/database";
import { ResellPortalClient } from "./resellportal.client";
import { AuditService } from "../audit/audit.service";
import { PlaceOrderDto } from "./provisioning.dto";

/**
 * Implements the poll pattern this whole stack is built around, because
 * ResellPortal has no webhooks:
 *
 *   place order -> local status "provisioning" -> background poll of
 *   GET /services -> flips to "deployed" -> internal event logged to audit
 *
 * The cron job below is the "background poll" half; placeOrder() is the
 * "place order" half. Nothing here talks to ResellPortal synchronously
 * except the initial order placement — a client should never be staring at
 * a spinner waiting on a chain of ResellPortal API calls.
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly resellPortal: ResellPortalClient,
    private readonly auditService: AuditService,
  ) {}

  async placeOrder(input: PlaceOrderDto) {
    const order = await prisma.provisioningOrder.create({
      data: {
        clientId: input.clientId,
        cpanelUsername: input.cpanelUsername,
        primaryDomain: input.primaryDomain,
        status: "provisioning",
      },
    });

    try {
      const result = await this.resellPortal.placeOrder({
        productKey: "web_hosting",
        clientId: input.resellPortalClientId,
        cpanelUsername: input.cpanelUsername,
        primaryDomain: input.primaryDomain,
        testMode: input.testMode,
      });

      await prisma.provisioningOrder.update({
        where: { id: order.id },
        data: { resellPortalOrderId: result.order_id },
      });

      await this.auditService.logAction({
        actor: "system:provisioning",
        action: "order.placed",
        targetType: "ProvisioningOrder",
        targetId: order.id,
        metadata: { resellPortalOrderId: result.order_id },
      });
    } catch (err) {
      await prisma.provisioningOrder.update({
        where: { id: order.id },
        data: { status: "failed" },
      });
      await this.auditService.logAction({
        actor: "system:provisioning",
        action: "order.failed",
        targetType: "ProvisioningOrder",
        targetId: order.id,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }

    return order;
  }

  findByClient(clientId: string) {
    return prisma.provisioningOrder.findMany({ where: { clientId } });
  }

  /**
   * Background poll — runs every minute. Sweeps every order still in
   * "provisioning" state and checks ResellPortal's actual deployment
   * status, since there is no other way to find out.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async pollPendingOrders() {
    const pending = await prisma.provisioningOrder.findMany({
      where: { status: "provisioning" },
    });

    for (const order of pending) {
      try {
        const client = await prisma.client.findUniqueOrThrow({
          where: { id: order.clientId },
        });
        const services = await this.resellPortal.getServices(client.fossbillingClientId);
        const match = services.find((s) => s.id === order.resellPortalOrderId);
        if (!match) continue;

        if (match.deployment_status === "deployed") {
          await prisma.provisioningOrder.update({
            where: { id: order.id },
            data: {
              status: "deployed",
              nextBillingDate: match.next_billing_date ? new Date(match.next_billing_date) : null,
            },
          });
          await this.auditService.logAction({
            actor: "system:provisioning-poller",
            action: "order.deployed",
            targetType: "ProvisioningOrder",
            targetId: order.id,
          });
          // Welcome-email flow hook: emit/handle here once the mail
          // provider integration exists.
        }
      } catch (err) {
        this.logger.warn(
          `Poll failed for ProvisioningOrder ${order.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
