import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import type { StripeService } from "../billing/stripe.service";
import { Phase3StripePaymentVerificationPort } from "./phase3-payment-verification.port";

const orderId = "order-1";
const orgId = "org-1";

describe("Phase3StripePaymentVerificationPort (Phase 11 payment observation)", { concurrency: false }, () => {
  const originalFindUnique = prisma.order.findUnique;
  afterEach(() => {
    prisma.order.findUnique = originalFindUnique;
  });

  function portWith(retrievePaymentState: (id: string) => Promise<unknown>) {
    const stripe = { retrievePaymentState: mock.fn(retrievePaymentState) } as unknown as StripeService;
    return { port: new Phase3StripePaymentVerificationPort(stripe), stripe };
  }

  it("reports verified when Stripe confirms a succeeded PaymentIntent", async () => {
    prisma.order.findUnique = mock.fn(async () => ({
      id: orderId, orgId, stripePaymentId: "pi_123",
    })) as never;
    const { port } = portWith(async () => ({ kind: "payment_intent", verified: true, rawStatus: "succeeded" }));

    const result = await port.verify(orderId, orgId);
    assert.deepEqual(result, {
      orderId, orgId, authority: "stripe", verified: true, evidenceRef: "pi_123",
    });
  });

  it("reports verified when Stripe confirms a paid Checkout Session", async () => {
    prisma.order.findUnique = mock.fn(async () => ({
      id: orderId, orgId, stripePaymentId: "cs_123",
    })) as never;
    const { port } = portWith(async () => ({ kind: "checkout_session", verified: true, rawStatus: "paid" }));

    const result = await port.verify(orderId, orgId);
    assert.deepEqual(result, {
      orderId, orgId, authority: "stripe", verified: true, evidenceRef: "cs_123",
    });
  });

  it("fails closed when Stripe reports the payment is not yet confirmed", async () => {
    prisma.order.findUnique = mock.fn(async () => ({
      id: orderId, orgId, stripePaymentId: "pi_123",
    })) as never;
    const { port } = portWith(async () => ({
      kind: "payment_intent", verified: false, rawStatus: "requires_payment_method",
    }));

    assert.deepEqual(await port.verify(orderId, orgId), {
      orderId, orgId, authority: "stripe", verified: false, evidenceRef: null,
    });
  });

  it("fails closed on not_found, unavailable, and unrecognized_id — never assumes verified", async () => {
    prisma.order.findUnique = mock.fn(async () => ({
      id: orderId, orgId, stripePaymentId: "pi_123",
    })) as never;
    for (const stripeResult of [{ kind: "not_found" }, { kind: "unavailable" }, { kind: "unrecognized_id" }]) {
      const { port } = portWith(async () => stripeResult);
      assert.deepEqual(await port.verify(orderId, orgId), {
        orderId, orgId, authority: "stripe", verified: false, evidenceRef: null,
      });
    }
  });

  it("never calls Stripe when there is no order, wrong org, or no stripePaymentId yet", async () => {
    const findUnique = mock.fn(async () => null);
    prisma.order.findUnique = findUnique as never;
    const retrieve = mock.fn(async () => ({ kind: "unavailable" }));
    const { port } = portWith(retrieve);

    assert.equal((await port.verify(orderId, orgId)).verified, false);
    assert.equal(retrieve.mock.callCount(), 0);

    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId: "other-org", stripePaymentId: "pi_1" })) as never;
    assert.equal((await port.verify(orderId, orgId)).verified, false);
    assert.equal(retrieve.mock.callCount(), 0);

    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId, stripePaymentId: null })) as never;
    assert.equal((await port.verify(orderId, orgId)).verified, false);
    assert.equal(retrieve.mock.callCount(), 0);
  });
});
