import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  assessEntitlementReadiness, correlationKey, unconfiguredObservations,
  type PaymentObservation, type FulfillmentObservation, type ProductEligibility,
  type PaymentVerificationPort, type FulfillmentVerificationPort, type ProductEligibilityPort,
} from "./phase3-contract-boundaries";

const orderId = "order_fixture";
const orgId = "org_fixture";
const product: ProductEligibility = {
  orderId, orgId, approved: true, mappingEvidenceRef: "approved-mapping-fixture",
};
const payment: PaymentObservation = {
  orderId, orgId, authority: "stripe", verified: true, evidenceRef: "stripe-evidence-fixture",
};
const fulfillment: FulfillmentObservation = {
  orderId, orgId, authority: "resellportal", verified: true,
  evidenceRef: "provider-evidence-fixture",
};

describe("Phase 3 mock-only contract boundaries", () => {
  it("defaults every unconfigured authority to a denied decision", () => {
    const facts = unconfiguredObservations(orderId, orgId);
    assert.deepEqual(
      assessEntitlementReadiness(orderId, orgId, facts.product, facts.payment, facts.fulfillment),
      { ready: false, reason: "product_unapproved", correlationKey: correlationKey(orderId, orgId) },
    );
  });

  it("blocks an unsupported product even if both observations appear verified", () => {
    assert.equal(assessEntitlementReadiness(
      orderId, orgId, { ...product, approved: false }, payment, fulfillment,
    ).reason, "product_unapproved");
  });

  it("blocks an unsupported or unverified Stripe observation", () => {
    assert.equal(assessEntitlementReadiness(
      orderId, orgId, product, { ...payment, verified: false }, fulfillment,
    ).reason, "payment_unverified");
    assert.equal(assessEntitlementReadiness(
      orderId, orgId, product, { ...payment, authority: "other" } as unknown as PaymentObservation,
      fulfillment,
    ).reason, "payment_unverified");
  });

  it("keeps verified payment separate from fulfillment", () => {
    assert.equal(assessEntitlementReadiness(
      orderId, orgId, product, payment, { ...fulfillment, verified: false },
    ).reason, "fulfillment_unverified");
  });

  it("keeps verified fulfillment separate from payment", () => {
    assert.equal(assessEntitlementReadiness(
      orderId, orgId, product, { ...payment, verified: false }, fulfillment,
    ).reason, "payment_unverified");
  });

  it("requires all three evidence references before reporting readiness", () => {
    for (const facts of [
      [{ ...product, mappingEvidenceRef: null }, payment, fulfillment],
      [product, { ...payment, evidenceRef: "" }, fulfillment],
      [product, payment, { ...fulfillment, evidenceRef: "  " }],
    ] as const) {
      assert.equal(assessEntitlementReadiness(orderId, orgId, ...facts).reason, "evidence_missing");
    }
    assert.equal(assessEntitlementReadiness(
      orderId, orgId, product, payment, fulfillment,
    ).ready, true);
  });

  it("rejects a changed tenant or mismatched order without exposing evidence", () => {
    const result = assessEntitlementReadiness(
      orderId, orgId, product, { ...payment, orgId: "other-org" }, fulfillment,
    );
    assert.deepEqual(result, {
      ready: false, reason: "scope_mismatch", correlationKey: correlationKey(orderId, orgId),
    });
    assert.equal(assessEntitlementReadiness(
      orderId, orgId, product, payment, { ...fulfillment, orderId: "other-order" },
    ).reason, "scope_mismatch");
  });

  it("uses a stable scoped correlation key with no raw payment data", () => {
    assert.equal(correlationKey(orderId, orgId), correlationKey(orderId, orgId));
    assert.notEqual(correlationKey(orderId, orgId), correlationKey(orderId, "other-org"));
    assert.notEqual(correlationKey(orderId, orgId), correlationKey("other-order", orgId));
    assert.equal(JSON.stringify(assessEntitlementReadiness(
      orderId, orgId, product, payment, fulfillment,
    )).includes(payment.evidenceRef!), false);
  });

  it("uses fixture ports only and never invokes an external API", async () => {
    const paymentPort: PaymentVerificationPort = { verify: mock.fn(async () => payment) };
    const fulfillmentPort: FulfillmentVerificationPort = { verify: mock.fn(async () => fulfillment) };
    const productPort: ProductEligibilityPort = { check: mock.fn(async () => product) };
    const observations = await Promise.all([
      productPort.check(orderId, orgId),
      paymentPort.verify(orderId, orgId),
      fulfillmentPort.verify(orderId, orgId),
    ]);
    assert.equal(assessEntitlementReadiness(orderId, orgId, ...observations).ready, true);
  });

  it("does not imply a provider operation or grant on concurrent assessments", async () => {
    const grant = mock.fn();
    const providerCall = mock.fn();
    const results = await Promise.all(Array.from({ length: 10 }, async () =>
      assessEntitlementReadiness(orderId, orgId, product, payment, fulfillment)));
    assert.equal(results.every((result) => result.ready), true);
    assert.equal(new Set(results.map((result) => result.correlationKey)).size, 1);
    assert.equal(grant.mock.callCount(), 0);
    assert.equal(providerCall.mock.callCount(), 0);
  });
});
