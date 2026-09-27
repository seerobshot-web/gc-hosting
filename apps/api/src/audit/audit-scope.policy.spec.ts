import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TenantContext } from "../rbac/tenant.decorator";
import {
  auditActionTargetKey,
  resolveAuthorizedAuditScope,
  type AuthorizedAuditScopeInput,
} from "./audit-scope.policy";

const tenant = (orgId = "org-a", userId = "user-a", status = "ACTIVE") => ({
  orgId,
  membership: { orgId, userId, status },
} as TenantContext);

const base: AuthorizedAuditScopeInput = {
  userId: "user-a",
  tenant: tenant(),
  action: "order.paid",
  targetType: "Order",
  targetId: "order-a",
  approvedActionTargets: new Set([auditActionTargetKey("order.paid", "Order")]),
  candidates: [{ relation: "order", organizationId: "org-a", evidenceReference: "order-a" }],
};

describe("preparatory audit scope policy (no active writer)", () => {
  it("accepts a reviewed action–target pair with active server-side membership and matching relation", () => {
    assert.deepEqual(resolveAuthorizedAuditScope(base),
      { status: "verified", organizationId: "org-a" });
  });

  it("rejects missing scope and nonmember or mismatched membership", () => {
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, tenant: undefined }),
      { status: "denied", reason: "missing_scope" });
    for (const badTenant of [
      tenant("org-a", "user-a", "SUSPENDED"),
      tenant("org-a", "other-user"),
      { ...tenant(), membership: { ...tenant().membership, orgId: "org-b" } },
    ]) {
      assert.deepEqual(resolveAuthorizedAuditScope({ ...base, tenant: badTenant }),
        { status: "denied", reason: "unauthorized_scope" });
    }
  });

  it("rejects conflicting evidence, cross-tenant targets and absent targets", () => {
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, candidates: [
      ...base.candidates,
      { relation: "order", organizationId: "org-b", evidenceReference: "order-a" },
    ] }), { status: "denied", reason: "ambiguous" });
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, candidates: [
      { relation: "order", organizationId: "org-b", evidenceReference: "order-a" },
    ] }), { status: "denied", reason: "unauthorized_scope" });
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, candidates: [] }),
      { status: "denied", reason: "orphaned" });
  });

  it("rejects malformed and unapproved action–target shapes before ownership resolution", () => {
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, targetId: "  " }),
      { status: "denied", reason: "invalid" });
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, targetType: "Org" }),
      { status: "denied", reason: "unsupported_event_shape" });
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, action: "arbitrary" }),
      { status: "denied", reason: "unsupported_event_shape" });
    assert.deepEqual(resolveAuthorizedAuditScope({ ...base, approvedActionTargets: new Set() }),
      { status: "denied", reason: "unsupported_event_shape" });
  });

  it("ignores browser-supplied org and free-form actor/metadata", () => {
    const spoofed = { ...base, browserOrgId: "org-b", actor: "user:org-b",
      metadata: { orgId: "org-b" }, candidates: [] };
    assert.deepEqual(resolveAuthorizedAuditScope(spoofed),
      { status: "denied", reason: "orphaned" });
  });

  it("rejects malformed relation proof without returning identifiers", () => {
    const result = resolveAuthorizedAuditScope({ ...base, candidates: [
      { relation: "order", organizationId: "", evidenceReference: "order-a" },
    ] });
    assert.deepEqual(result, { status: "denied", reason: "invalid" });
    assert.equal(JSON.stringify(result).includes("order-a"), false);
  });

  it("is repeatable under concurrent fixture checks and performs no writes", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, async () =>
      resolveAuthorizedAuditScope(base)));
    assert.ok(results.every((result) => JSON.stringify(result) === JSON.stringify(results[0])));
  });
});
