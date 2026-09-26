import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ResellPortalContractGapError } from "./resellportal-contract-gap.error";
import { productMappingRecordSchema } from "./resellportal-contract.schema";
import { approvedPhaseOneToolSlugs, resellPortalProductMappings } from "./resellportal-mapping.registry";
import {
  assertVerifiedPurchaseMapping,
  createResellPortalContractGapDiagnostic,
  getProductMapping,
  isPurchaseEnabled,
} from "./resellportal-mapping.service";
import {
  createProductContractFixture,
  createProductMappingFixture,
} from "./__fixtures__/resellportal-contract.fixtures";

describe("ResellPortal product mapping registry", () => {
  it("contains every approved Phase 1 slug and no purchase-enabled entry", () => {
    assert.deepEqual(
      resellPortalProductMappings.map((mapping) => mapping.gchSlug).sort(),
      [...approvedPhaseOneToolSlugs].sort(),
    );
    assert.ok(resellPortalProductMappings.every((mapping) => mapping.purchaseEnabled === false));
    assert.ok(resellPortalProductMappings.every((mapping) => mapping.externalProductId === null));
    assert.ok(resellPortalProductMappings.every((mapping) => mapping.externalProductKey === null));
  });

  it("returns undefined for unknown slugs", () => {
    assert.equal(getProductMapping("not-a-real-tool"), undefined);
    assert.equal(isPurchaseEnabled("not-a-real-tool"), false);
  });
});

describe("assertVerifiedPurchaseMapping", () => {
  it("fails closed when an enabled mapping is missing an external product id", () => {
    assert.throws(
      () => productMappingRecordSchema.parse(createProductMappingFixture({ externalProductId: null })),
      /externalProductId/,
    );
  });

  it("fails closed when the verified contract requires an external key but the mapping is missing it", () => {
    assert.throws(
      () =>
        assertVerifiedPurchaseMapping("web-hosting", "monthly", {
          registry: [createProductMappingFixture({ externalProductKey: null })],
          observedContract: createProductContractFixture({ externalKey: "web_hosting" }),
        }),
      (error: unknown) =>
        error instanceof ResellPortalContractGapError &&
        error.diagnostic.missingFacts.includes("product-identifier-semantics"),
    );
  });

  it("fails closed when the mapping has an external key but the observed contract does not", () => {
    assert.throws(
      () =>
        assertVerifiedPurchaseMapping("web-hosting", "monthly", {
          registry: [createProductMappingFixture({ externalProductKey: "web_hosting" })],
          observedContract: createProductContractFixture(),
        }),
      (error: unknown) =>
        error instanceof ResellPortalContractGapError &&
        error.diagnostic.missingFacts.includes("product-identifier-semantics"),
    );
  });

  it("fails closed when an enabled mapping is missing a billing cycle", () => {
    assert.throws(
      () => productMappingRecordSchema.parse(createProductMappingFixture({ billingCycle: null })),
      /billingCycle/,
    );
  });

  it("fails closed when an enabled mapping is missing an approved destination", () => {
    assert.throws(
      () =>
        productMappingRecordSchema.parse(
          createProductMappingFixture({ approvedOrderDestination: null }),
        ),
      /approvedOrderDestination/,
    );
  });

  it("fails closed for pending mappings", () => {
    const mapping = createProductMappingFixture({
      verificationStatus: "pending-verification",
      purchaseEnabled: false,
      externalProductId: null,
      billingCycle: null,
      approvedOrderDestination: null,
      sourceEvidence: "missing-contract",
    });

    assert.throws(
      () => assertVerifiedPurchaseMapping("web-hosting", "monthly", { registry: [mapping] }),
      (error: unknown) =>
        error instanceof ResellPortalContractGapError &&
        error.diagnostic.summary.includes("pending contract verification"),
    );
    assert.equal(isPurchaseEnabled("web-hosting", "monthly", [mapping]), false);
  });

  it("fails closed for disabled mappings", () => {
    const mapping = createProductMappingFixture({
      verificationStatus: "disabled",
      purchaseEnabled: false,
    });

    assert.throws(
      () => assertVerifiedPurchaseMapping("web-hosting", "monthly", { registry: [mapping] }),
      (error: unknown) =>
        error instanceof ResellPortalContractGapError &&
        error.diagnostic.summary.includes("disabled"),
    );
    assert.equal(isPurchaseEnabled("web-hosting", "monthly", [mapping]), false);
  });

  it("does not treat unknown upstream availability as available", () => {
    assert.throws(
      () =>
        assertVerifiedPurchaseMapping("web-hosting", "monthly", {
          registry: [createProductMappingFixture()],
          observedContract: createProductContractFixture({
            availability: "unknown",
            rawStatus: "mystery-state",
          }),
        }),
      (error: unknown) =>
        error instanceof ResellPortalContractGapError &&
        error.diagnostic.missingFacts.includes("availability-semantics"),
    );
  });

  it("returns a verified mapping only when every safety gate passes", () => {
    const verified = assertVerifiedPurchaseMapping("web-hosting", "monthly", {
      registry: [createProductMappingFixture({ externalProductKey: "web_hosting" })],
      observedContract: createProductContractFixture({ externalKey: "web_hosting" }),
    });

    assert.equal(verified.gchSlug, "web-hosting");
    assert.equal(verified.purchaseEnabled, true);
    assert.equal(isPurchaseEnabled("web-hosting", "monthly", [verified]), true);
  });

  it("fails closed when a verified mapping omits required fields even if purchase stays disabled", () => {
    assert.throws(
      () =>
        productMappingRecordSchema.parse(
          createProductMappingFixture({
            purchaseEnabled: false,
            externalProductId: null,
          }),
        ),
      /externalProductId/,
    );
  });
});

describe("ResellPortal contract-gap diagnostics", () => {
  it("do not expose secrets or raw payload fragments", () => {
    const diagnostic = createResellPortalContractGapDiagnostic(
      "Missing verified ResellPortal mapping facts.",
      ["product-identifier-semantics", "retry-safety"],
      { gchSlug: "web-hosting", billingCycle: "monthly" },
    );

    const serialized = JSON.stringify(diagnostic);
    assert.ok(serialized.includes("web-hosting"));
    assert.ok(serialized.includes("retry-safety"));
    assert.ok(!serialized.includes("sk_live_"));
    assert.ok(!serialized.includes("X-API-Secret"));
    assert.ok(!serialized.includes("\"payload\""));
  });
});
