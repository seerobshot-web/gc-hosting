import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { AuditService } from "./audit.service";
import type { AuditTenantResolverService } from "./audit-tenant-resolver.service";
import { mintApprovedSystemJobPrincipal } from "./audit-tenant-resolver.types";

function fakeResolver(resolve: (...args: unknown[]) => Promise<unknown>) {
  return { resolve: mock.fn(resolve) } as unknown as AuditTenantResolverService;
}

function fakeDb() {
  return { auditLog: { create: mock.fn(async ({ data }: { data: unknown }) => data) } };
}

describe("AuditService.logAction (Phase 6 resolver wiring)", () => {
  it("preserves the exact pre-Phase-6 write when no principal is supplied", async () => {
    const resolver = fakeResolver(async () => {
      throw new Error("must not be called without a principal");
    });
    const db = fakeDb();
    const service = new AuditService(resolver);
    const row = await service.logAction(
      { actor: "user:a", action: "org.updated", targetType: "Org", targetId: "org-1" },
      db as never,
    );
    assert.equal((row as { orgId: string | null }).orgId, null);
  });

  it("leaves orgId null for an action not yet in the rollout allowlist, even with a principal", async () => {
    const resolver = fakeResolver(async () => {
      throw new Error("must not be called for a not-yet-enabled action");
    });
    const db = fakeDb();
    const service = new AuditService(resolver);
    const row = await service.logAction(
      {
        actor: "system:stripe.webhook",
        action: "order.paid",
        targetType: "Order",
        targetId: "order-1",
        principal: mintApprovedSystemJobPrincipal("stripe.webhook"),
      },
      db as never,
    );
    assert.equal((row as { orgId: string | null }).orgId, null);
  });

  it("attaches orgId when the resolver resolves", async () => {
    const resolver = fakeResolver(async () => ({ kind: "resolved", organizationId: "org-1" }));
    const db = fakeDb();
    const service = new AuditService(resolver);
    const row = await service.logAction(
      {
        actor: "user:a",
        action: "org.updated",
        targetType: "Org",
        targetId: "org-1",
        principal: mintApprovedSystemJobPrincipal("stripe.webhook"),
      },
      db as never,
    );
    assert.equal((row as { orgId: string | null }).orgId, "org-1");
  });

  it("writes orgId null (never blocks the write) for any non-resolved outcome", async () => {
    for (const resolution of [
      { kind: "not_found" },
      { kind: "not_member" },
      { kind: "cross_tenant" },
      { kind: "unavailable", retryable: true },
      { kind: "malformed_evidence", reason: "relation_unavailable" },
    ]) {
      const resolver = fakeResolver(async () => resolution);
      const db = fakeDb();
      const service = new AuditService(resolver);
      const row = await service.logAction(
        {
          actor: "user:a",
          action: "org.updated",
          targetType: "Org",
          targetId: "org-1",
          principal: mintApprovedSystemJobPrincipal("stripe.webhook"),
        },
        db as never,
      );
      assert.equal((row as { orgId: string | null }).orgId, null);
    }
  });

  it("writes orgId null and never throws when the resolver itself throws", async () => {
    const resolver = fakeResolver(async () => {
      throw new Error("db exploded");
    });
    const db = fakeDb();
    const service = new AuditService(resolver);
    const row = await service.logAction(
      {
        actor: "user:a",
        action: "org.updated",
        targetType: "Org",
        targetId: "org-1",
        principal: mintApprovedSystemJobPrincipal("stripe.webhook"),
      },
      db as never,
    );
    assert.equal((row as { orgId: string | null }).orgId, null);
  });
});
