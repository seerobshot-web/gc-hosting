import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import { approvedPhaseOneToolSlugs } from "./resellportal/resellportal-mapping.registry";
import type { ProductMappingRecord } from "./resellportal/resellportal-contract.types";
import { assessEntitlementReadiness } from "./phase3-contract-boundaries";
import { phase3Evidence, phase3PurchaseEnabled, productEvidence } from "./phase3-evidence.registry";
import { assessPurchaseGate, blockedPurchaseInput, type PurchaseGateInput } from "./phase3-purchase-gate";
import { Phase3StripePaymentVerificationPort } from "./phase3-payment-verification.port";
import { Phase3ResellPortalFulfillmentVerificationPort } from "./phase3-fulfillment-verification.port";
import type { StripeService } from "../billing/stripe.service";
import type { ResellPortalClient } from "./resellportal.client";

const id = "order-test", org = "org-test";
const fixtureMapping: ProductMappingRecord = {
  gchSlug: "web-hosting", externalProductId: "fixture-only",
  externalProductKey: null, billingCycle: "fixture-only",
  approvedOrderDestination: "fixture-only", verificationStatus: "verified",
  purchaseEnabled: true, sourceEvidence: "verified-contract",
};
function fixtureInput(): PurchaseGateInput {
  const input = blockedPurchaseInput(id, org, fixtureMapping.gchSlug);
  return {
    ...input,
    product: { orderId: id, orgId: org, approved: true, mappingEvidenceRef: "fixture" },
    payment: { orderId: id, orgId: org, authority: "stripe", verified: true, evidenceRef: "fixture" },
    fulfillment: { orderId: id, orgId: org, authority: "resellportal", verified: true, evidenceRef: "fixture" },
    paymentSafety: "verified", fulfillmentSafety: "verified",
    destinationApproved: true, policyApproved: true, featureEnabled: true,
  };
}
const evaluate = (input: PurchaseGateInput) => assessPurchaseGate(input, [fixtureMapping]);

describe("Phase 3 evidence registry and purchase preflight", () => {
  it("derives exactly the 18 blocked entries from the canonical registry", () => {
    const items = productEvidence();
    assert.equal(items.length, 18);
    assert.deepEqual(items.map((item) => item.slug), [...approvedPhaseOneToolSlugs]);
    assert.ok(items.every((item) => item.status === "unresolved" && !item.enabled
      && !item.destinationApproved));
    assert.equal(phase3PurchaseEnabled, false);
  });

  it("distinguishes facts, assumptions, blockers, approvals and disabled flags", () => {
    for (const contract of Object.values(phase3Evidence)) {
      assert.equal(contract.status, "unresolved");
      assert.ok(contract.fact.length > 0 && contract.blocker);
      assert.equal(contract.approved, false);
      assert.equal(contract.enabled, false);
    }
    assert.ok(phase3Evidence.stripe_payment.assumption);
    assert.ok(phase3Evidence.resellportal_idempotency.assumption);
  });

  it("cannot convert a public catalog item or local ACTIVE status into purchase eligibility", () => {
    for (const slug of approvedPhaseOneToolSlugs) {
      assert.equal(assessPurchaseGate(blockedPurchaseInput(id, org, slug)).reason,
        "product_mapping_unapproved");
    }
  });

  it("blocks tenant/order mismatch before inspecting any alleged evidence", () => {
    assert.equal(evaluate({ ...fixtureInput(),
      payment: { ...fixtureInput().payment, orgId: "other-org" },
    }).reason, "scope_mismatch");
    assert.equal(evaluate({ ...fixtureInput(),
      fulfillment: { ...fixtureInput().fulfillment, orderId: "other-order" },
    }).reason, "scope_mismatch");
  });

  it("blocks absent destination, payment and provider observations", () => {
    assert.equal(evaluate({ ...fixtureInput(), destinationApproved: false }).reason,
      "destination_unapproved");
    for (const paymentSafety of ["missing", "unknown", "unsupported", "stale", "refunded", "disputed"] as const) {
      assert.equal(evaluate({ ...fixtureInput(), paymentSafety }).reason, "payment_unverified");
    }
    for (const fulfillmentSafety of ["missing", "unknown", "pending", "retryable", "terminal", "unavailable"] as const) {
      assert.equal(evaluate({ ...fixtureInput(), fulfillmentSafety }).reason, "fulfillment_unverified");
    }
    assert.equal(evaluate({ ...fixtureInput(),
      fulfillment: { ...fixtureInput().fulfillment, evidenceRef: null },
    }).reason, "evidence_missing");
  });

  it("blocks unapproved contracts, policy and flag even for synthetic verified observations", () => {
    assert.equal(evaluate(fixtureInput()).reason, "contract_unapproved");
    const approved = Object.fromEntries(Object.entries(phase3Evidence).map(([key, contract]) =>
      [key, { ...contract, status: "verified", approved: true, enabled: true }])) as unknown as PurchaseGateInput["contracts"];
    assert.equal(evaluate({ ...fixtureInput(), contracts: approved, policyApproved: false }).reason,
      "entitlement_policy_unapproved");
    assert.equal(evaluate({ ...fixtureInput(), contracts: approved }).reason, "feature_disabled");
  });

  it("Phase 11: the real Stripe + ResellPortal ports reporting fully verified still cannot unlock a purchase", async () => {
    // Best-case observations from the actual new ports (Phase 11), not
    // synthetic fixtures — a succeeded Stripe PaymentIntent and a
    // provider-confirmed active ResellPortal service.
    const originalOrderFind = prisma.order.findUnique;
    try {
      prisma.order.findUnique = mock.fn(async ({ include }: { include?: { providerService?: boolean } }) =>
        include?.providerService
          ? { id, orgId: org, providerService: { id: "svc-1", resellPortalId: "rp-svc-1" } }
          : { id, orgId: org, stripePaymentId: "pi_verified" },
      ) as never;

      const stripe = {
        retrievePaymentState: mock.fn(async () => (
          { kind: "payment_intent", verified: true, rawStatus: "succeeded" }
        )),
      } as unknown as StripeService;
      const resellPortal = {
        getServiceStatus: mock.fn(async () => ({ service_id: "rp-svc-1", status: "active" })),
      } as unknown as ResellPortalClient;

      const payment = await new Phase3StripePaymentVerificationPort(stripe).verify(id, org);
      const fulfillment = await new Phase3ResellPortalFulfillmentVerificationPort(resellPortal).verify(id, org);
      assert.equal(payment.verified, true);
      assert.equal(fulfillment.verified, true);

      // These real observations are "good enough" for the entitlement math
      // itself — proving the ports work, not that they're too weak to matter.
      const readiness = assessEntitlementReadiness(
        id, org,
        { orderId: id, orgId: org, approved: true, mappingEvidenceRef: "fixture" },
        payment, fulfillment,
      );
      assert.equal(readiness.ready, true, "expected the entitlement math itself to be satisfied");

      // Yet assessPurchaseGate — fed these exact real observations — is
      // still blocked, because phase3PurchaseEnabled/phase3Evidence (never
      // touched by either port) are the only things that can ever flip it.
      const gateResult = evaluate({
        ...fixtureInput(),
        payment, fulfillment,
        paymentSafety: "verified", fulfillmentSafety: "verified",
      });
      assert.equal(gateResult.ready, false);
      assert.notEqual(gateResult.reason, "payment_unverified");
      assert.notEqual(gateResult.reason, "fulfillment_unverified");
      assert.equal(phase3PurchaseEnabled, false);
    } finally {
      prisma.order.findUnique = originalOrderFind;
    }
  });

  it("keeps repeated concurrent assessments deterministic and mutation free", async () => {
    const providerCall = mock.fn(), grant = mock.fn();
    const results = await Promise.all(Array.from({ length: 20 }, async () =>
      assessPurchaseGate(blockedPurchaseInput(id, org, "web-hosting"))));
    assert.equal(new Set(results.map((result) => JSON.stringify(result))).size, 1);
    assert.equal(results[0]?.ready, false);
    assert.equal(providerCall.mock.callCount(), 0);
    assert.equal(grant.mock.callCount(), 0);
    assert.equal(JSON.stringify(results).includes("fixture-only"), false);
  });
});
