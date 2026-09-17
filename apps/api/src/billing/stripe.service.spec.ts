import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { ConfigService } from "@nestjs/config";
import { StripeService } from "./stripe.service";

/**
 * These tests assert the adapter (a) maps raw Stripe responses into domain
 * DTOs and (b) forwards a Stripe idempotency-key header on every mutating
 * call. The SDK is fully mocked — no network, no keys.
 */
function serviceWithClient(client: unknown): StripeService {
  const config = {
    get: (k: string) => (k === "GCH_PORTAL_ORIGIN" ? "https://portal.test" : undefined),
  } as unknown as ConfigService;
  const service = new StripeService(config);
  // Seed the lazily-constructed SDK client so the getter returns our mock.
  (service as unknown as { instance: unknown }).instance = client;
  return service;
}

describe("StripeService.createCheckoutSession", () => {
  it("passes the idempotency key and maps the response to a domain DTO", async () => {
    const create = mock.fn(async () => ({
      id: "cs_123",
      url: "https://checkout.stripe.com/c/pay/cs_123",
      customer: "cus_1",
    }));
    const client = { checkout: { sessions: { create } } };
    const service = serviceWithClient(client);

    const result = await service.createCheckoutSession(
      {
        mode: "subscription",
        customerId: "cus_1",
        clientReferenceId: "org_1",
        lineItems: [{ price: "price_1", quantity: 2 }],
        metadata: { orgId: "org_1", planId: "plan_1" },
        subscriptionMetadata: { orgId: "org_1", planId: "plan_1" },
        successUrl: "https://portal.test/ok",
        cancelUrl: "https://portal.test/no",
      },
      "idem-checkout-1",
    );

    assert.deepEqual(result, {
      id: "cs_123",
      url: "https://checkout.stripe.com/c/pay/cs_123",
      customerId: "cus_1",
    });
    assert.equal(create.mock.callCount(), 1);
    const [body, opts] = create.mock.calls[0]!.arguments as unknown as [
      Record<string, unknown>,
      { idempotencyKey: string },
    ];
    // The idempotency key must be forwarded in the SDK options arg.
    assert.equal(opts.idempotencyKey, "idem-checkout-1");
    assert.equal(body.mode, "subscription");
    assert.equal(body.customer, "cus_1");
    assert.equal(body.client_reference_id, "org_1");
    assert.deepEqual(body.line_items, [{ price: "price_1", quantity: 2 }]);
    assert.deepEqual(body.subscription_data, { metadata: { orgId: "org_1", planId: "plan_1" } });
  });
});

describe("StripeService.createBillingPortalSession", () => {
  it("creates a portal session for the customer and returns id + url", async () => {
    const create = mock.fn(async () => ({ id: "bps_1", url: "https://billing.stripe.com/p/1" }));
    const client = { billingPortal: { sessions: { create } } };
    const service = serviceWithClient(client);

    const result = await service.createBillingPortalSession("cus_9");

    assert.deepEqual(result, { id: "bps_1", url: "https://billing.stripe.com/p/1" });
    assert.equal(create.mock.callCount(), 1);
    const [body] = create.mock.calls[0]!.arguments as unknown as [Record<string, unknown>];
    assert.equal(body.customer, "cus_9");
    assert.equal(body.return_url, "https://portal.test/dashboard/billing");
  });
});

describe("StripeService.cancelSubscription", () => {
  it("passes the idempotency key and maps the response to a domain DTO", async () => {
    const cancel = mock.fn(async () => ({
      id: "sub_1",
      status: "canceled",
      cancel_at_period_end: false,
      canceled_at: 1710000000,
    }));
    const client = { subscriptions: { cancel } };
    const service = serviceWithClient(client);

    const result = await service.cancelSubscription("sub_1", "idem-cancel-1");

    assert.deepEqual(result, {
      id: "sub_1",
      status: "canceled",
      cancelAtPeriodEnd: false,
      canceledAt: 1710000000,
    });
    assert.equal(cancel.mock.callCount(), 1);
    const args = cancel.mock.calls[0]!.arguments as unknown as [string, undefined, { idempotencyKey: string }];
    assert.equal(args[0], "sub_1");
    assert.equal(args[2].idempotencyKey, "idem-cancel-1");
  });
});
