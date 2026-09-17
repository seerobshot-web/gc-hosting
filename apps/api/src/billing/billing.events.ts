/**
 * Internal domain events emitted onto the NestJS EventEmitter after a Stripe
 * webhook has been fully processed and persisted. These are the seam between
 * Phase 4 (billing / order state) and Phase 5 (provisioning): the webhook
 * service is the only emitter, downstream listeners are the only consumers.
 *
 * Event names are stable strings — they double as the audit `action`.
 */

/** Emitted when an order moves PENDING -> PAID. Phase 5 provisioning listens. */
export const ORDER_PAID = "order.paid";

/** Emitted when a Stripe subscription is cancelled/deleted. */
export const SUBSCRIPTION_CANCELLED = "subscription.cancelled";

/** Payload for {@link ORDER_PAID}. */
export interface OrderPaidEvent {
  orderId: string;
  orgId: string;
  planId: string;
  /** Stripe PaymentIntent / session id backing the payment, when known. */
  stripePaymentId: string | null;
}

/** Payload for {@link SUBSCRIPTION_CANCELLED}. */
export interface SubscriptionCancelledEvent {
  orgId: string;
  /** Stripe subscription id that was cancelled, when resolvable. */
  stripeSubscriptionId: string | null;
  /** The order transitioned ACTIVE -> CANCELLED as a result, if any. */
  orderId: string | null;
}
