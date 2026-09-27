import { Injectable } from "@nestjs/common";
import { prisma } from "@gch/database";
import { StripeService } from "../billing/stripe.service";
import type { PaymentObservation, PaymentVerificationPort } from "./phase3-contract-boundaries";

/**
 * Real Stripe-backed implementation of PaymentVerificationPort (Phase 11).
 *
 * This answers exactly one question — "does Stripe itself currently
 * confirm this order's payment?" — via a fresh server-side read. It never
 * authorizes a purchase and is not wired into any route or into
 * assessPurchaseGate; phase3PurchaseEnabled and phase3Evidence are
 * untouched, so nothing this port observes can make a purchase possible on
 * its own. A local Order.stripePaymentId is used only to know *which*
 * Stripe object to ask about — never as the verification itself.
 */
@Injectable()
export class Phase3StripePaymentVerificationPort implements PaymentVerificationPort {
  constructor(private readonly stripe: StripeService) {}

  async verify(orderId: string, orgId: string): Promise<PaymentObservation> {
    const notVerified = (): PaymentObservation => ({
      orderId, orgId, authority: "stripe", verified: false, evidenceRef: null,
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.orgId !== orgId) return notVerified();
    if (!order.stripePaymentId) return notVerified();

    const state = await this.stripe.retrievePaymentState(order.stripePaymentId);
    if (
      (state.kind === "payment_intent" || state.kind === "checkout_session") &&
      state.verified
    ) {
      return { orderId, orgId, authority: "stripe", verified: true, evidenceRef: order.stripePaymentId };
    }
    // not_found / unavailable / unrecognized_id / verified:false — all fail closed.
    return notVerified();
  }
}
