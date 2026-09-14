import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, prisma, Role } from "@gch/database";
import type Stripe from "stripe";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { paymentFailedEmail } from "../email/templates";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";
import { StripeService } from "./stripe.service";

const ACTOR = "system:stripe-webhook";

/**
 * Every handler is an upsert keyed by a Stripe id, and every event id is
 * recorded in WebhookEvent before processing — so redelivery, out-of-order
 * delivery, and replay are all safe. Nothing here talks back to Stripe.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
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

    // Claim the event id first. A unique-key violation means we already
    // processed this delivery — acknowledge so Stripe stops retrying.
    try {
      await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { received: true, duplicate: true };
      }
      throw err;
    }

    try {
      await this.dispatch(event);
    } catch (err) {
      // Release the claim so Stripe's retry gets a real second attempt.
      await prisma.webhookEvent.delete({ where: { id: event.id } }).catch(() => undefined);
      throw err;
    }

    return { received: true };
  }

  private async dispatch(event: Stripe.Event) {
    switch (event.type) {
      case "checkout.session.completed":
        return this.onCheckoutCompleted(event.data.object);
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return this.onSubscriptionChanged(event.data.object);
      case "invoice.paid":
      case "invoice.payment_failed":
        return this.onInvoice(event.data.object, event.type);
      default:
        this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orgId = session.metadata?.orgId ?? session.client_reference_id;
    if (!orgId || session.mode !== "subscription") return;

    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);
    if (!customerId) return;

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

  private async onSubscriptionChanged(sub: Stripe.Subscription) {
    const orgId = await this.resolveOrgId(sub);
    if (!orgId) {
      this.logger.warn(`Stripe subscription ${sub.id} has no resolvable orgId — skipped`);
      return;
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
  }

  private async onInvoice(invoice: Stripe.Invoice, type: string) {
    const stripeSubId = idOf(invoice.parent?.subscription_details?.subscription);
    const sub = stripeSubId
      ? await prisma.subscription.findUnique({ where: { stripeSubscriptionId: stripeSubId } })
      : await this.subscriptionByCustomer(idOf(invoice.customer));
    if (!sub) {
      this.logger.warn(`Invoice ${invoice.id} has no matching Subscription — skipped`);
      return;
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

/** Stripe fields are `string | ExpandedObject | null`; we only store ids. */
function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}
