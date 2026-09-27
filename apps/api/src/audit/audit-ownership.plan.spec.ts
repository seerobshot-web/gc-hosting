import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditBackfillDryRun, classifyAuditOwnership,
  type AuditOwnershipFixture,
} from "./audit-ownership.plan";

const row: AuditOwnershipFixture = {
  auditId: "audit-1", action: "order.paid", targetType: "Order", targetId: "order-1",
  candidates: [{ organizationId: "org-a", relation: "order", evidenceReference: "order-1" }],
};

describe("fixture-only audit ownership planning", () => {
  it("classifies an authoritative Order.orgId candidate deterministically", () => {
    const result = classifyAuditOwnership(row);
    assert.deepEqual(result, {
      auditId: "audit-1", classification: "authoritatively_attributable",
      organizationId: "org-a", evidenceReference: "order-1",
      safeReasonCode: "single_authoritative_relation",
    });
  });

  it("keeps already scoped ownership unchanged when relation agrees", () => {
    const result = classifyAuditOwnership({ ...row, existingOrganizationId: "org-a" });
    assert.equal(result.classification, "already_scoped");
    assert.equal(result.organizationId, "org-a");
  });

  it("quarantines competing candidates and an existing tenant mismatch", () => {
    const competing = { ...row.candidates[0]!, organizationId: "org-b" };
    assert.equal(classifyAuditOwnership({ ...row, candidates: [...row.candidates, competing] })
      .classification, "ambiguous");
    const mismatch = classifyAuditOwnership({ ...row, existingOrganizationId: "org-b" });
    assert.deepEqual([mismatch.classification, mismatch.safeReasonCode],
      ["ambiguous", "tenant_mismatch"]);
    assert.equal(mismatch.organizationId, undefined);
  });

  it("leaves missing targets orphaned and malformed evidence invalid", () => {
    assert.equal(classifyAuditOwnership({ ...row, candidates: [] }).classification, "orphaned");
    assert.equal(classifyAuditOwnership({ ...row, targetId: "" }).classification, "invalid");
    assert.equal(classifyAuditOwnership({ ...row,
      candidates: [{ organizationId: "", relation: "order", evidenceReference: "order-1" }],
    }).classification, "invalid");
  });

  it("quarantines unsupported event shapes without trusting metadata", () => {
    assert.equal(classifyAuditOwnership({ ...row, targetType: "ExternalProviderService" })
      .classification, "unsupported_event_shape");
    const spoofed = { ...row, candidates: [],
      metadata: { orgId: "org-a" }, actor: "user:org-a" };
    assert.equal(classifyAuditOwnership(spoofed).classification, "orphaned");
  });

  it("produces repeatable zero-write aggregate counts without record identifiers", async () => {
    const rows = [
      row,
      { ...row, auditId: "2", existingOrganizationId: "org-a" },
      { ...row, auditId: "3", candidates: [] },
      { ...row, auditId: "4", targetType: "Unknown" },
      { ...row, auditId: "5", action: "" },
      { ...row, auditId: "6", existingOrganizationId: "org-b" },
    ];
    const results = await Promise.all(Array.from({ length: 8 }, async () =>
      auditBackfillDryRun(rows)));
    assert.ok(results.every((item) => JSON.stringify(item) === JSON.stringify(results[0])));
    assert.deepEqual(results[0], {
      examined: 6, alreadyScoped: 1, attributable: 1, ambiguous: 1,
      orphaned: 1, invalid: 1, unsupported: 1, manualReviewRequired: 4,
      projectedIndexes: ["AuditLog(orgId, createdAt, id)"], writesPerformed: 0,
    });
    assert.equal(JSON.stringify(results).includes("order-1"), false);
  });

  it("enforces bounded dry-run batches", () => {
    assert.throws(() => auditBackfillDryRun(Array(1001).fill(row)), RangeError);
  });
});
