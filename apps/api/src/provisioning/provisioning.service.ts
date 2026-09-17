import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OnEvent } from "@nestjs/event-emitter";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderStatus, Prisma, ProviderStatus, prisma } from "@gch/database";
import { ResellPortalClient } from "./resellportal.client";
import { AuditService } from "../audit/audit.service";
import { PlaceOrderDto } from "./provisioning.dto";
import {
  ORDER_PAID,
  OrderPaidEvent,
  SUBSCRIPTION_CANCELLED,
  SubscriptionCancelledEvent,
} from "../billing/billing.events";
import {
  OrderTransition,
  nextOrderStatus,
  peekNextOrderStatus,
} from "../billing/order-state-machine";
import { RetryOptions, retryWithBackoff } from "./retry";
import {
  SERVICE_PROVISIONED,
  SERVICE_PROVISIONING_FAILED,
} from "./provisioning.events";

/** Every automated write from this orchestrator is attributed to this actor. */
const SYSTEM_ACTOR = "system";

/** Idempotency records for provisioning live 7 days (per docs/IDEMPOTENCY.md). */
const PROVISIONING_IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Phase 5 — Provisioning Durability.
 *
 * The provisioning orchestrator is EVENT-DRIVEN: it never gets called inline
 * from the Stripe webhook handler. Instead it listens for the domain events
 * the billing layer emits after it has durably persisted an order transition:
 *
 *   order.paid            -> provisionService()  (PAID -> PROVISIONING -> ACTIVE)
 *   subscription.cancelled -> terminateService() (ACTIVE -> CANCELLED)
 *
 * Everything here is built to survive retries and redelivery:
 *  - The ProviderService.orderId @unique constraint is the DB-level guard
 *    against two concurrent provisions of the same order.
 *  - IdempotencyRecord replays a completed provision instead of re-running it.
 *  - The outbound ResellPortal call is wrapped in bounded exponential-backoff
 *    retry; a full exhaustion fails the order and raises an alert.
 *
 * The legacy placeOrder/poll pair below is the pre-ALEPH ResellPortal flow and
 * is kept intact for the existing controller; the new methods are the durable
 * path the order state machine drives.
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly resellPortal: ResellPortalClient,
    private readonly auditService: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  // ===========================================================================
  // Phase 5: event-driven durable provisioning
  // ===========================================================================

  /**
   * React to `order.paid`. This is the ONLY trigger for provisioning — the
   * billing webhook emits the event after it has committed PENDING -> PAID, so
   * provisioning is fully decoupled from the webhook request. Failures are
   * swallowed here (already audited + alerted inside provisionService) so a
   * listener error can never bubble into the event emitter.
   */
  @OnEvent(ORDER_PAID)
  async handleOrderPaid(event: OrderPaidEvent): Promise<void> {
    const idempotencyKey = ResellPortalClient.idempotencyKey(
      "order",
      event.orderId,
      "provisionService",
    );
    try {
      await this.provisionService(event.orderId, idempotencyKey);
    } catch (err) {
      // provisionService has already flipped the order to FAILED, written the
      // audit row and emitted service.provisioning_failed. Nothing left to do
      // but keep the listener from throwing.
      this.logger.error(
        `Provisioning failed for order ${event.orderId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * React to `subscription.cancelled` by tearing down the provisioned service.
   * A cancelled subscription revokes access, so we terminate (not merely
   * suspend) the ResellPortal service and move the order to CANCELLED.
   */
  @OnEvent(SUBSCRIPTION_CANCELLED)
  async handleSubscriptionCancelled(event: SubscriptionCancelledEvent): Promise<void> {
    if (!event.orderId) return;
    try {
      await this.terminateService(event.orderId);
    } catch (err) {
      this.logger.error(
        `Termination failed for order ${event.orderId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Idempotently provision the ResellPortal service for a paid order.
   *
   * @param orderId        the GCH order to provision
   * @param idempotencyKey deterministic key for this provision operation
   * @param retryOptions   backoff/sleep overrides (tests inject a no-op sleep
   *                       so they never wait the real 21s backoff budget)
   */
  async provisionService(
    orderId: string,
    idempotencyKey: string,
    retryOptions: RetryOptions = {},
  ) {
    // (a) Already provisioned & ACTIVE -> idempotent no-op.
    const existing = await prisma.providerService.findUnique({ where: { orderId } });
    if (existing && existing.status === ProviderStatus.ACTIVE) {
      return existing;
    }

    // (b) A completed provision for this exact operation key -> replay.
    const replay = await prisma.idempotencyRecord.findUnique({
      where: { key: idempotencyKey },
    });
    if (replay) {
      const svc = await prisma.providerService.findUnique({ where: { orderId } });
      if (svc) return svc;
    }

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    // (c) Transition PAID -> PROVISIONING and create the ProviderService row
    //     BEFORE calling ResellPortal, so the orderId @unique constraint blocks
    //     a concurrent double-provision. `resellPortalId` is required + unique,
    //     so we seed a per-order placeholder now and swap it for the real id on
    //     success.
    let providerService;
    try {
      providerService = await prisma.$transaction(async (tx) => {
        const to = nextOrderStatus(order.status, OrderTransition.StartProvisioning);
        await tx.order.update({ where: { id: order.id }, data: { status: to } });
        return tx.providerService.create({
          data: {
            orderId: order.id,
            resellPortalId: `pending:${order.id}`,
            status: ProviderStatus.PROVISIONING,
          },
        });
      });
    } catch (err) {
      // Unique-constraint violation on orderId => another worker already began
      // provisioning this order. Treat as "already provisioning": return its row.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        this.logger.warn(
          `Order ${order.id} is already being provisioned (unique guard hit) — no-op.`,
        );
        const svc = await prisma.providerService.findUnique({ where: { orderId } });
        if (svc) return svc;
      }
      throw err;
    }

    // (d) Call ResellPortal, wrapped in bounded exponential-backoff retry.
    try {
      const created = await retryWithBackoff(
        () =>
          this.resellPortal.createService(
            { orderId: order.id, planId: order.planId, orgId: order.orgId },
            idempotencyKey,
          ),
        {
          ...retryOptions,
          onRetry: (attempt, error) => {
            this.logger.warn(
              `ResellPortal.createService attempt ${attempt} failed for order ${
                order.id
              }: ${error instanceof Error ? error.message : String(error)}`,
            );
            retryOptions.onRetry?.(attempt, error);
          },
        },
      );

      // (e) Success: ProviderService -> ACTIVE, Order -> ACTIVE, persist the
      //     idempotency record, audit + emit — all in one transaction so a
      //     crash can't leave a half-committed success.
      const activeOrderStatus = nextOrderStatus(
        OrderStatus.PROVISIONING,
        OrderTransition.ProvisioningSucceeded,
      );
      const now = new Date();
      const result = await prisma.$transaction(async (tx) => {
        const svc = await tx.providerService.update({
          where: { orderId: order.id },
          data: {
            status: ProviderStatus.ACTIVE,
            resellPortalId: created.service_id,
            provisionedAt: now,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: activeOrderStatus },
        });
        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            result: {
              providerServiceId: svc.id,
              resellPortalId: created.service_id,
              status: svc.status,
            },
            expiresAt: new Date(now.getTime() + PROVISIONING_IDEMPOTENCY_TTL_MS),
          },
        });
        await this.auditService.logAction(
          {
            actor: SYSTEM_ACTOR,
            action: SERVICE_PROVISIONED,
            targetType: "ProviderService",
            targetId: svc.id,
            metadata: { orderId: order.id, resellPortalId: created.service_id },
          },
          tx,
        );
        return svc;
      });

      this.events.emit(SERVICE_PROVISIONED, {
        orderId: order.id,
        providerServiceId: result.id,
        resellPortalId: result.resellPortalId,
      });
      return result;
    } catch (err) {
      // (f) Retries exhausted (or a post-call failure). Fail the order, mark
      //     the dead provider row TERMINATED (ProviderStatus has no FAILED),
      //     raise an alert, then rethrow so the retry/listener sees it.
      const reason = err instanceof Error ? err.message : String(err);
      const failedStatus = nextOrderStatus(OrderStatus.PROVISIONING, OrderTransition.Fail);
      try {
        await prisma.$transaction(async (tx) => {
          await tx.providerService.update({
            where: { orderId: order.id },
            data: { status: ProviderStatus.TERMINATED },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { status: failedStatus },
          });
          await this.auditService.logAction(
            {
              actor: SYSTEM_ACTOR,
              action: SERVICE_PROVISIONING_FAILED,
              targetType: "ProviderService",
              targetId: providerService.id,
              metadata: { orderId: order.id, reason },
            },
            tx,
          );
        });
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to record provisioning failure for order ${order.id}: ${
            cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)
          }`,
        );
      }

      // Alert: logger + the failed domain event (an alerting listener consumes it).
      this.logger.error(
        `ALERT: provisioning exhausted retries for order ${order.id}: ${reason}`,
      );
      this.events.emit(SERVICE_PROVISIONING_FAILED, { orderId: order.id, reason });
      throw err;
    }
  }

  /**
   * Suspend the provisioned service for an order (reversible). Uses a
   * deterministic idempotency key, moves ProviderService -> SUSPENDED and the
   * order -> CANCELLED, and audits the action.
   */
  async suspendService(orderId: string) {
    return this.changeServiceLifecycle(orderId, {
      operationName: "suspendService",
      call: (resellPortalId, key) => this.resellPortal.suspendService(resellPortalId, key),
      providerStatus: ProviderStatus.SUSPENDED,
      auditAction: "service.suspended",
    });
  }

  /**
   * Permanently terminate the provisioned service for an order. Uses a
   * deterministic idempotency key, moves ProviderService -> TERMINATED and the
   * order -> CANCELLED, and audits the action.
   */
  async terminateService(orderId: string) {
    return this.changeServiceLifecycle(orderId, {
      operationName: "terminateService",
      call: (resellPortalId, key) => this.resellPortal.terminateService(resellPortalId, key),
      providerStatus: ProviderStatus.TERMINATED,
      auditAction: "service.terminated",
    });
  }

  /** Shared suspend/terminate machinery — the only difference is the RP call,
   *  the resulting ProviderStatus and the audit action. */
  private async changeServiceLifecycle(
    orderId: string,
    opts: {
      operationName: string;
      call: (resellPortalId: string, idempotencyKey: string) => Promise<unknown>;
      providerStatus: ProviderStatus;
      auditAction: string;
    },
  ) {
    const svc = await prisma.providerService.findUniqueOrThrow({ where: { orderId } });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    const idempotencyKey = ResellPortalClient.idempotencyKey(
      "providerService",
      svc.id,
      opts.operationName,
    );
    await opts.call(svc.resellPortalId, idempotencyKey);

    // ACTIVE -> CANCELLED via the state machine; if the order is already in a
    // terminal state (e.g. suspended earlier), skip the order update rather
    // than throw so the lifecycle call stays idempotent.
    const nextOrder = peekNextOrderStatus(order.status, OrderTransition.Cancel);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.providerService.update({
        where: { orderId },
        data: { status: opts.providerStatus },
      });
      if (nextOrder) {
        await tx.order.update({ where: { id: orderId }, data: { status: nextOrder } });
      }
      await this.auditService.logAction(
        {
          actor: SYSTEM_ACTOR,
          action: opts.auditAction,
          targetType: "ProviderService",
          targetId: svc.id,
          metadata: { orderId, providerStatus: opts.providerStatus },
        },
        tx,
      );
      return updated;
    });
  }

  // ===========================================================================
  // Legacy ResellPortal flow (pre-ALEPH) — retained for the existing controller
  // ===========================================================================

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
      });

      return await prisma.$transaction(async (tx) => {
        const placedOrder = await tx.provisioningOrder.update({
          where: { id: order.id },
          data: { resellPortalOrderId: result.order_id },
        });

        await this.auditService.logAction(
          {
            actor: "system:provisioning",
            action: "order.placed",
            targetType: "ProvisioningOrder",
            targetId: order.id,
            metadata: { resellPortalOrderId: result.order_id },
          },
          tx,
        );

        return placedOrder;
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
