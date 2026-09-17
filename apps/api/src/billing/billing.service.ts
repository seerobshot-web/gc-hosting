import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { prisma } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import type { TenantContext } from "../rbac/tenant.decorator";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";
import { StripeService } from "./stripe.service";

/** Stripe statuses under which seats are billable and a plan is in force. */
export const LIVE_STATUSES = ["active", "trialing", "past_due"];

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
  ) {}

  listPlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { pricePerSeatCents: "asc" },
    });
  }

  /** Seats = active memberships. The single definition every caller uses. */
  seatsUsed(orgId: string) {
    return prisma.membership.count({ where: { orgId, status: MEMBERSHIP_ACTIVE } });
  }

  async getSubscription(orgId: string) {
    const [subscription, seatsUsed] = await Promise.all([
      prisma.subscription.findUnique({ where: { orgId }, include: { plan: true } }),
      this.seatsUsed(orgId),
    ]);
    return { subscription, seatsUsed };
  }

  listInvoices(orgId: string) {
    return prisma.invoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /**
   * Called before a Membership is added. A plan with a seatLimit is a hard
   * cap; no plan (or an unlimited plan) never blocks.
   */
  async assertSeatAvailable(orgId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    });
    const limit = sub?.plan?.seatLimit;
    if (limit == null || !LIVE_STATUSES.includes(sub!.status)) return;
    const used = await this.seatsUsed(orgId);
    if (used >= limit) {
      throw new ForbiddenException(
        `Seat limit reached (${used}/${limit}) — upgrade the plan to add members`,
      );
    }
  }

  /**
   * Push the current seat count to Stripe as the subscription item quantity.
   * Best-effort by design: a Stripe outage must not block a membership
   * change, and the next customer.subscription.updated webhook reconciles
   * seatsPurchased regardless.
   */
  async syncSeats(orgId: string, actor: string) {
    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    if (!sub?.stripeSubscriptionItemId || !LIVE_STATUSES.includes(sub.status)) return;

    const quantity = await this.seatsUsed(orgId);
    if (quantity === sub.seatsPurchased) return;

    try {
      await this.stripe.client.subscriptionItems.update(sub.stripeSubscriptionItemId, {
        quantity,
        proration_behavior: "create_prorations",
      });
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { seatsPurchased: quantity },
      });
      await this.audit.logAction({
        actor,
        action: "subscription.seats_synced",
        targetType: "Subscription",
        targetId: sub.id,
        metadata: { orgId, from: sub.seatsPurchased, to: quantity },
      });
    } catch (err) {
      this.logger.warn(
        `Seat sync failed for org ${orgId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async createCheckoutSession(tenant: TenantContext, planId: string, customerEmail: string) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new NotFoundException(`Plan ${planId} not found`);

    const existing = await prisma.subscription.findUnique({ where: { orgId: tenant.orgId } });
    if (existing && LIVE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        "This workspace already has a subscription — use the billing portal to change plans",
      );
    }

    const seats = await this.seatsUsed(tenant.orgId);
    if (plan.seatLimit != null && seats > plan.seatLimit) {
      throw new ConflictException(
        `This plan allows ${plan.seatLimit} seats but the workspace has ${seats} members`,
      );
    }

    const customerId = existing?.stripeCustomerId ?? (await this.createCustomer(tenant, customerEmail));

    const session = await this.stripe.createCheckoutSession(
      {
        mode: "subscription",
        customerId,
        clientReferenceId: tenant.orgId,
        lineItems: [{ price: plan.stripePriceId, quantity: Math.max(seats, 1) }],
        // Metadata on both the session and the subscription it creates: the
        // webhook handlers resolve the Org from whichever event arrives first.
        metadata: { orgId: tenant.orgId, planId: plan.id },
        subscriptionMetadata: { orgId: tenant.orgId, planId: plan.id },
        successUrl: `${this.stripe.portalOrigin}/dashboard/billing?checkout=success`,
        cancelUrl: `${this.stripe.portalOrigin}/dashboard/billing?checkout=cancelled`,
      },
      // Deterministic per (org, plan) operation identity — a retried checkout
      // for the same plan de-duplicates at Stripe (IDEMPOTENCY.md convention).
      checkoutIdempotencyKey(tenant.orgId, plan.id),
    );

    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "billing.checkout_started",
      targetType: "Org",
      targetId: tenant.orgId,
      metadata: { planId: plan.id, seats, sessionId: session.id },
    });

    return { url: session.url };
  }

  async createPortalSession(tenant: TenantContext) {
    const sub = await prisma.subscription.findUnique({ where: { orgId: tenant.orgId } });
    if (!sub) {
      throw new NotFoundException("No billing account yet — start a subscription first");
    }
    const session = await this.stripe.createBillingPortalSession(sub.stripeCustomerId);
    return { url: session.url };
  }

  private async createCustomer(tenant: TenantContext, email: string) {
    const org = await prisma.org.findUniqueOrThrow({ where: { id: tenant.orgId } });
    const customer = await this.stripe.client.customers.create({
      email,
      name: org.name,
      metadata: { orgId: org.id },
    });
    // Placeholder row so the customer id survives an abandoned checkout;
    // status stays "incomplete" until Stripe's subscription events arrive.
    await prisma.subscription.create({
      data: { orgId: org.id, stripeCustomerId: customer.id },
    });
    return customer.id;
  }
}

/** Deterministic Stripe idempotency key for a checkout, per IDEMPOTENCY.md. */
function checkoutIdempotencyKey(orgId: string, planId: string): string {
  return createHash("sha256")
    .update(`Org:${orgId}:createCheckoutSession:${planId}`)
    .digest("hex");
}
