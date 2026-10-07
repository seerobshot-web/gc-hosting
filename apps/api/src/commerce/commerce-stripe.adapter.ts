import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

@Injectable()
export class CommerceStripeAdapter {
  constructor(private readonly config: ConfigService) {}
  private client(): Stripe {
    const key = this.config.get<string>("STRIPE_SECRET_KEY");
    // This rollout is test-only. Live enablement requires a separate reviewed change.
    if (!key?.startsWith("sk_test_"))
      throw new ServiceUnavailableException("commerce_requires_stripe_test_key");
    return new Stripe(key);
  }
  verify(body: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>("COMMERCE_STRIPE_WEBHOOK_SECRET");
    if (!secret) throw new ServiceUnavailableException("commerce_webhook_secret_missing");
    return this.client().webhooks.constructEvent(body, signature, secret);
  }
  async create(input: {
    orderId: string;
    dealId: string;
    version: string;
    amountCents: number;
    email: string;
    name: string;
    successUrl: string;
    cancelUrl: string;
    ach: boolean;
  }) {
    const session = await this.client().checkout.sessions.create(
      {
        automatic_tax: { enabled: false }, // Only the explicit, reviewed "none" tax mode is supported in this test rollout.
        mode: "payment",
        customer_email: input.email,
        client_reference_id: input.orderId,
        metadata: {
          order_id: input.orderId,
          deal_id: input.dealId,
          catalog_version: input.version,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: input.amountCents,
              product_data: { name: input.name },
            },
          },
        ],
        payment_method_types: input.ach ? ["card", "us_bank_account"] : ["card"],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      { idempotencyKey: `CommerceOrder:${input.orderId}:checkout` },
    );
    return { id: session.id, url: session.url };
  }
  async paid(sessionId: string): Promise<boolean> {
    const session = await this.client().checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge"],
    });
    const payment = session.payment_intent;
    if (
      session.livemode ||
      session.payment_status !== "paid" ||
      !payment ||
      typeof payment === "string" ||
      payment.status !== "succeeded"
    )
      return false;
    const charge = payment.latest_charge;
    return Boolean(
      charge &&
      typeof charge !== "string" &&
      charge.paid &&
      !charge.refunded &&
      !charge.disputed &&
      charge.amount_refunded === 0,
    );
  }
}
