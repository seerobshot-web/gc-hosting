import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderStatus, Prisma, prisma, Role } from "@gch/database";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { paymentFailedEmail } from "../email/templates";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";
import {
  ORDER_PAID,
  SUBSCRIPTION_CANCELLED,
  type OrderPaidEvent,
  type SubscriptionCancelledEvent,
} from "./billing.events";
import {
  InvalidOrderTransitionError,
  OrderTransition,
  nextOrderStatus,
} from "./order-state-machine";
import { StripeService } from "./stripe.service";

/** Audit actor for everything this service writes. */
const ACTOR = "stripe-webhook";

/** Replay window for processed webhook events (IDEMPOTENCY.md: 24h default). */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** A domain event to publish once the transition is durably recorded. */
interface PendingEvent {
  name: string;
  payload: OrderPaidEvent | SubscriptionCancelledEvent;
}

/** What a handler produces: a JSON-serializable result plus events to emit. */
interface DispatchOutcome {
  result: Prisma.JsonObject;
  events: PendingEvent[];
}

/**
 * Idempotent Stripe webhook processor.
 *
 * Every delivery is keyed by its Stripe EVENT id in `IdempotencyRecord`:
 *   1. Verify the signature over the raw body (the endpoint's whole security
 *      boundary).
 *   2. If a record already exists for this event id, REPLAY the cached result
 *      and return — no side effects, no duplicate domain events.
 *   3. Otherwise run the state transition, persist the result (with a 24h
 *      TTL), then emit the internal domain event(s). Persisting before
 *      emitting guarantees a concurrent/redelivered copy replays instead of
 *      re-emitting.
 *
 * Nothing here calls back out to Stripe.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly events: EventEmitter2,
  ) {}

  async handle(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !signature) {
      throw new BadRequestException("Missing body or stripe-signature header");
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.client.webhooks.constructEvent(
        rawBody,
        signature,
        this.stripe.webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(
        `Invalid Stripe signature: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const key = idempotencyKeyFor(event);

    // (1) Replay path — a record for this event id means we already processed
    // it. Return the cached result verbatim without re-running side effects.
    const existing = await prisma.idempotencyRecord.findUnique({ where: { key } });
    if (existing) {
      this.logger.debug(`Replaying processed Stripe event ${event.id} (${event.type})`);
      return existing.result;
    }

    // (2) First time seen — run the transition and collect domain events.
    const outcome = await this.dispatch(event);

    // (3) Persist the result BEFORE emitting. If a concurrent delivery beat us
    // to the insert (P2002 on the unique key), treat this as a replay: return
    // the stored result and do NOT emit a second copy of the domain events.
    try {
      await prisma.idempotencyRecord.create({
        data: {
          key,
          result: outcome.result,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await prisma.idempotencyRecord.findUnique({ where: { key } });
        this.logger.debug(`Concurrent delivery of ${event.id} already recorded — replaying`);
        return winner?.result ?? outcome.result;
      }
      throw err;
    }

    for (const e of outcome.events) {
      this.events.emit(e.name, e.payload);
    }

    return outcome.result;
  }

  private async dispatch(event: Stripe.Event): Promise<DispatchOutcome> {
    switch (event.type) {
      case "checkout.session.completed":
        return this.onCheckoutCompleted(event.data.object);
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return this.onSubscriptionChanged(event.data.object, event.type);
      case "invoice.paid":
      case "invoice.payment_failed":
        return this.onInvoice(event.data.object, event.type);
      default:
        this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
        return { result: { received: true, handled: false, type: event.type }, events: [] };
    }
  }

  /**
   * checkout.session.completed — the commercial transaction is confirmed.
   * Upserts the Subscription mirror (unchanged) AND drives the order line
   * PENDING -> PAID through the pure state machine, auditing the transition
   * and emitting `order.paid` for Phase 5 provisioning to pick up.
   */
  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<DispatchOutcome> {
    const orgId = session.metadata?.orgId ?? session.client_reference_id ?? null;
    const events: PendingEvent[] = [];
    const result: Prisma.JsonObject = {
      received: true,
      handled: "checkout.session.completed",
    };

    if (!orgId || session.mode !== "subscription") {
      return { result: { ...result, skipped: "no orgId or non-subscription mode" }, events };
    }

    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);
    if (customerId) {
      await prisma.subscription.upsert({
        where: { orgId },
        create: {
          orgId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          planId: session.metadata?.planId ?? null,
        },
        update: {
          stripeCustomerId: customerId,
          ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
          ...(session.metadata?.planId ? { planId: session.metadata.planId } : {}),
        },
      });
    }

    // Drive the order line to PAID. `orderId` in metadata wins; otherwise the
    // most recent PENDING order for the org; otherwise create one from
    // metadata.planId (the Plan FK set by billing.service at checkout).
    const planId = session.metadata?.planId ?? null;
    const stripePaymentId = idOf(session.payment_intent) ?? session.id;
    const order = await this.resolvePayableOrder(orgId, session.metadata?.orderId ?? null, planId);
    if (!order) {
      return { result: { ...result, orderSkipped: "no order and no planId to create one" }, events };
    }

    try {
      const to = nextOrderStatus(order.status, OrderTransition.Pay);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: to, stripePaymentId },
      });
      await this.audit.logAction({
        actor: ACTOR,
        action: ORDER_PAID,
        targetType: "Order",
        targetId: order.id,
        metadata: { orgId, before: order.status, after: to, stripePaymentId },
      });
      events.push({
        name: ORDER_PAID,
        payload: { orderId: order.id, orgId, planId: order.planId, stripePaymentId },
      });
      return { result: { ...result, orderId: order.id, orderStatus: to }, events };
    } catch (err) {
      return {
        result: { ...result, ...(await this.auditInvalidTransition(order, OrderTransition.Pay, err)) },
        events,
      };
    }
  }

  /**
   * customer.subscription.* — mirrors the Stripe subscription into our table.
   * On `deleted` it additionally drives any ACTIVE order ACTIVE -> CANCELLED
   * and always emits `subscription.cancelled`.
   */
  private async onSubscriptionChanged(
    sub: Stripe.Subscription,
    type: Stripe.Event["type"],
  ): Promise<DispatchOutcome> {
    const events: PendingEvent[] = [];
    const orgId = await this.resolveOrgId(sub);
    if (!orgId) {
      this.logger.warn(`Stripe subscription ${sub.id} has no resolvable orgId — skipped`);
      return { result: { received: true, handled: type, skipped: "no orgId" }, events };
    }

    const item = sub.items.data[0];
    const plan = item
      ? await prisma.plan.findUnique({ where: { stripePriceId: item.price.id } })
      : null;

    const previous = await prisma.subscription.findUnique({ where: { orgId } });
    const data = {
      stripeCustomerId: idOf(sub.customer) ?? previous?.stripeCustomerId ?? "",
      stripeSubscriptionId: sub.id,
      stripeSubscriptionItemId: item?.id ?? null,
      status: sub.status,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      seatsPurchased: item?.quantity ?? 0,
      planId: plan?.id ?? previous?.planId ?? null,
    };

    const saved = await prisma.subscription.upsert({
      where: { orgId },
      create: { orgId, ...data },
      update: data,
    });

    if (previous?.status !== saved.status) {
      await this.audit.logAction({
        actor: ACTOR,
        action: "subscription.status_changed",
        targetType: "Subscription",
        targetId: saved.id,
        metadata: { orgId, from: previous?.status ?? null, to: saved.status },
      });
    }

    if (type !== "customer.subscription.deleted") {
      return { result: { received: true, handled: type, orgId }, events };
    }

    // Cancellation: transition the live order (if any) and always announce it.
    let cancelledOrderId: string | null = null;
    const activeOrder = await prisma.order.findFirst({
      where: { orgId, status: OrderStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });
    if (activeOrder) {
      try {
        const to = nextOrderStatus(activeOrder.status, OrderTransition.Cancel);
        await prisma.order.update({ where: { id: activeOrder.id }, data: { status: to } });
        await this.audit.logAction({
          actor: ACTOR,
          action: "order.cancelled",
          targetType: "Order",
          targetId: activeOrder.id,
          metadata: { orgId, before: activeOrder.status, after: to },
        });
        cancelledOrderId = activeOrder.id;
      } catch (err) {
        await this.auditInvalidTransition(activeOrder, OrderTransition.Cancel, err);
      }
    }

    const payload: SubscriptionCancelledEvent = {
      orgId,
      stripeSubscriptionId: sub.id,
      orderId: cancelledOrderId,
    };
    events.push({ name: SUBSCRIPTION_CANCELLED, payload });
    return {
      result: { received: true, handled: type, orgId, cancelledOrderId },
      events,
    };
  }

  private async onInvoice(
    invoice: Stripe.Invoice,
    type: "invoice.paid" | "invoice.payment_failed",
  ): Promise<DispatchOutcome> {
    const stripeSubId = idOf(invoice.parent?.subscription_details?.subscription);
    const sub = stripeSubId
      ? await prisma.subscription.findUnique({ where: { stripeSubscriptionId: stripeSubId } })
      : await this.subscriptionByCustomer(idOf(invoice.customer));
    if (!sub) {
      this.logger.warn(`Invoice ${invoice.id} has no matching Subscription — skipped`);
      return { result: { received: true, handled: type, skipped: "no subscription" }, events: [] };
    }

    const data = {
      orgId: sub.orgId,
      subscriptionId: sub.id,
      status: invoice.status ?? "unknown",
      currency: invoice.currency,
      amountDueCents: invoice.amount_due,
      amountPaidCents: invoice.amount_paid,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
    };
    const saved = await prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: { stripeInvoiceId: invoice.id, ...data },
      update: data,
    });

    await this.audit.logAction({
      actor: ACTOR,
      action: type === "invoice.paid" ? "invoice.paid" : "invoice.payment_failed",
      targetType: "Invoice",
      targetId: saved.id,
      metadata: { orgId: sub.orgId, amountDueCents: invoice.amount_due },
    });

    if (type === "invoice.payment_failed") {
      await this.notifyOwnersOfFailedPayment(sub.orgId, invoice);
    }

    return { result: { received: true, handled: type, invoiceId: saved.id }, events: [] };
  }

  /**
   * Find the order to move to PAID: an explicit metadata orderId, else the
   * most recent PENDING order for the org, else a freshly created PENDING
   * order (only possible when metadata carries a planId FK). Returns null when
   * there is nothing to act on.
   */
  private async resolvePayableOrder(orgId: string, orderId: string | null, planId: string | null) {
    if (orderId) {
      const byId = await prisma.order.findUnique({ where: { id: orderId } });
      if (byId) return byId;
    }
    const pending = await prisma.order.findFirst({
      where: { orgId, status: OrderStatus.PENDING },
      orderBy: { createdAt: "desc" },
    });
    if (pending) return pending;
    if (!planId) return null;
    return prisma.order.create({ data: { orgId, planId, status: OrderStatus.PENDING } });
  }

  /** Record a rejected transition as an audit event; returns a result fragment. */
  private async auditInvalidTransition(
    order: { id: string; status: OrderStatus; planId: string },
    transition: OrderTransition,
    err: unknown,
  ): Promise<Prisma.JsonObject> {
    if (!(err instanceof InvalidOrderTransitionError)) throw err;
    this.logger.warn(
      `Rejected order ${order.id} transition ${transition} from ${order.status}: ${err.message}`,
    );
    await this.audit.logAction({
      actor: ACTOR,
      action: "order.transition_rejected",
      targetType: "Order",
      targetId: order.id,
      metadata: { from: order.status, transition, reason: err.message },
    });
    return { orderId: order.id, transitionRejected: transition, orderStatus: order.status };
  }

  /** Billing notices go to every OWNER — they're the only role that can fix it. */
  private async notifyOwnersOfFailedPayment(orgId: string, invoice: Stripe.Invoice) {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      include: {
        memberships: {
          where: { role: Role.OWNER, status: MEMBERSHIP_ACTIVE },
          include: { user: { select: { email: true } } },
        },
      },
    });
    if (!org) return;
    const billingUrl = `${this.stripe.portalOrigin}/dashboard/billing`;
    for (const m of org.memberships) {
      try {
        await this.email.send(
          paymentFailedEmail({
            to: m.user.email,
            orgName: org.name,
            amountDueCents: invoice.amount_due,
            currency: invoice.currency,
            billingUrl,
          }),
        );
      } catch (err) {
        this.logger.warn(
          `Payment-failed email to ${m.user.email} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async resolveOrgId(sub: Stripe.Subscription): Promise<string | null> {
    if (sub.metadata?.orgId) return sub.metadata.orgId;
    const bySubId = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (bySubId) return bySubId.orgId;
    const byCustomer = await this.subscriptionByCustomer(idOf(sub.customer));
    return byCustomer?.orgId ?? null;
  }

  private subscriptionByCustomer(customerId: string | null) {
    if (!customerId) return null;
    return prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
  }
}

/**
 * Deterministic idempotency key for a webhook delivery, derived from the
 * Stripe event id (stable across redeliveries) per IDEMPOTENCY.md's
 * sha256(entityType:entityId:operationName) convention.
 */
function idempotencyKeyFor(event: Stripe.Event): string {
  return createHash("sha256").update(`StripeEvent:${event.id}:${event.type}`).digest("hex");
}

/** Stripe fields are `string | ExpandedObject | null`; we only store ids. */
function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}
