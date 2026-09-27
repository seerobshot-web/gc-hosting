import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

/**
 * Typed adapter over the Stripe SDK. Callers never see raw `Stripe.*` types:
 * every mutating method takes a plain params object and returns a small domain
 * DTO defined below. Every mutating call sets Stripe's idempotency-key header
 * so a retried request (same key) is de-duplicated by Stripe itself, matching
 * the deterministic-idempotency rule in IDEMPOTENCY.md.
 *
 * The SDK client is constructed lazily so the api still boots (and every
 * non-billing route works) without Stripe keys; the first billing call fails
 * loudly, naming the missing variable.
 */

export interface CreateCheckoutSessionParams {
  /** Only "subscription" is used today; kept explicit for callers. */
  mode: "subscription";
  customerId: string;
  clientReferenceId?: string;
  lineItems: Array<{ price: string; quantity: number }>;
  /** Metadata on the Checkout Session itself. */
  metadata?: Record<string, string>;
  /** Metadata propagated onto the Subscription the session creates. */
  subscriptionMetadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  id: string;
  url: string | null;
  customerId: string | null;
}

export interface BillingPortalSessionResult {
  id: string;
  url: string;
}

export interface CancelSubscriptionResult {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  /** Unix seconds when Stripe recorded the cancellation, if set. */
  canceledAt: number | null;
}

/**
 * A fresh, server-side read of Stripe's own state for a stored payment
 * identifier — never a re-statement of anything GCH already believed
 * locally. `verified` reflects only Stripe's own documented status field
 * for the object kind actually retrieved:
 *  - PaymentIntent: `status === "succeeded"` (Stripe's own terminal-success value).
 *  - Checkout Session: `payment_status === "paid"` (Stripe's own field for
 *    "the session's payment is confirmed," distinct from session completion).
 * `unrecognized_id`/`not_found`/`unavailable` all mean "cannot verify" —
 * never "verified" by default.
 */
export type StripePaymentState =
  | { kind: "payment_intent"; verified: boolean; rawStatus: string }
  | { kind: "checkout_session"; verified: boolean; rawStatus: string }
  | { kind: "not_found" }
  | { kind: "unrecognized_id" }
  | { kind: "unavailable" };

@Injectable()
export class StripeService {
  private instance?: Stripe;

  constructor(private readonly config: ConfigService) {}

  /**
   * Raw SDK client. Retained for the few billing.service calls that don't yet
   * have a dedicated adapter method (customer + subscription-item updates) and
   * for webhook signature verification. New call sites should prefer the typed
   * methods below rather than reaching through this getter.
   */
  get client(): Stripe {
    if (!this.instance) {
      const key = this.config.get<string>("STRIPE_SECRET_KEY");
      if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
      this.instance = new Stripe(key);
    }
    return this.instance;
  }

  get webhookSecret(): string {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    return secret;
  }

  get portalOrigin(): string {
    return this.config.get<string>("GCH_PORTAL_ORIGIN") ?? "http://localhost:3001";
  }

  /**
   * Create a Checkout Session. `idempotencyKey` should be a deterministic key
   * derived from the operation identity so a retry returns the same session.
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
    idempotencyKey: string,
  ): Promise<CheckoutSessionResult> {
    const session = await this.client.checkout.sessions.create(
      {
        mode: params.mode,
        customer: params.customerId,
        ...(params.clientReferenceId ? { client_reference_id: params.clientReferenceId } : {}),
        line_items: params.lineItems.map((li) => ({ price: li.price, quantity: li.quantity })),
        ...(params.metadata ? { metadata: params.metadata } : {}),
        ...(params.subscriptionMetadata
          ? { subscription_data: { metadata: params.subscriptionMetadata } }
          : {}),
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
      { idempotencyKey },
    );
    return {
      id: session.id,
      url: session.url,
      customerId: refId(session.customer),
    };
  }

  /**
   * Create a Billing Portal session for an existing customer. Read-oriented
   * (returns a short-lived URL), so no idempotency key is required.
   */
  async createBillingPortalSession(customerId: string): Promise<BillingPortalSessionResult> {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.portalOrigin}/dashboard/billing`,
    });
    return { id: session.id, url: session.url };
  }

  /** Cancel a subscription immediately. Mutating -> idempotency key required. */
  async cancelSubscription(
    subscriptionId: string,
    idempotencyKey: string,
  ): Promise<CancelSubscriptionResult> {
    const sub = await this.client.subscriptions.cancel(subscriptionId, undefined, {
      idempotencyKey,
    });
    return {
      id: sub.id,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ?? null,
    };
  }

  /**
   * Read-only, server-side re-read of a stored payment identifier's actual
   * Stripe state. `stripePaymentId` (see Order.stripePaymentId) is either a
   * PaymentIntent id (`pi_...`) or, for the sessions where Stripe doesn't
   * attach one, a Checkout Session id (`cs_...`) — dispatched by prefix,
   * never assumed. Any error (not found, network, unexpected shape) is
   * `unavailable`/`not_found`, never treated as verified.
   */
  async retrievePaymentState(stripePaymentId: string): Promise<StripePaymentState> {
    try {
      if (stripePaymentId.startsWith("pi_")) {
        const intent = await this.client.paymentIntents.retrieve(stripePaymentId);
        return { kind: "payment_intent", verified: intent.status === "succeeded", rawStatus: intent.status };
      }
      if (stripePaymentId.startsWith("cs_")) {
        const session = await this.client.checkout.sessions.retrieve(stripePaymentId);
        return {
          kind: "checkout_session",
          verified: session.payment_status === "paid",
          rawStatus: session.payment_status,
        };
      }
      return { kind: "unrecognized_id" };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError && err.statusCode === 404) {
        return { kind: "not_found" };
      }
      return { kind: "unavailable" };
    }
  }
}

/** Stripe refs are `string | ExpandedObject | null`; we only keep the id. */
function refId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}
