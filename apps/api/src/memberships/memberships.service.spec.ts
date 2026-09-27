import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma, Role } from "@gch/database";
import type { AuditService } from "../audit/audit.service";
import { mintGuardVerifiedAuditPrincipal } from "../audit/audit-tenant-resolver.types";
import type { BillingService } from "../billing/billing.service";
import type { TenantContext } from "../rbac/tenant.decorator";
import { MembershipsService } from "./memberships.service";

const tenant: TenantContext = {
  orgId: "org-a",
  membership: { userId: "user-a", orgId: "org-a", role: Role.OWNER, status: "ACTIVE" } as TenantContext["membership"],
};

describe("MembershipsService audit wiring (Phase 6, Family 1)", { concurrency: false }, () => {
  const originals = {
    findUnique: prisma.membership.findUnique,
    update: prisma.membership.update,
    transaction: prisma.$transaction,
  };
  afterEach(() => {
    prisma.membership.findUnique = originals.findUnique;
    prisma.membership.update = originals.update;
    prisma.$transaction = originals.transaction;
  });

  it("audits membership.removed with a guard-verified principal BEFORE the row is deleted, atomically", async () => {
    const order: string[] = [];
    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m-1", userId: "user-b", orgId: "org-a", role: Role.MEMBER,
      status: "ACTIVE", createdAt: new Date(),
    })) as never;

    const tx = {
      membership: { delete: mock.fn(async () => { order.push("delete"); }) },
    };
    prisma.$transaction = (async (cb: (t: unknown) => unknown) => cb(tx)) as never;

    const logAction = mock.fn(async (input: unknown, _db?: unknown) => {
      order.push("logAction");
      return input;
    });
    const audit = { logAction } as unknown as AuditService;
    const syncSeats = mock.fn(async () => undefined);
    const billing = { syncSeats } as unknown as BillingService;
    const service = new MembershipsService(audit, billing);
    await service.remove(tenant, "m-1");

    assert.deepEqual(order, ["logAction", "delete"]);
    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; organizationId?: string; userId?: string };
    };
    assert.equal(call.action, "membership.removed");
    assert.equal(call.targetType, "Membership");
    assert.equal(call.targetId, "m-1");
    assert.deepEqual(call.principal, mintGuardVerifiedAuditPrincipal(tenant, "user-a"));
    assert.equal(logAction.mock.calls[0]!.arguments[1], tx);
    // Seat sync happens only after the transaction commits.
    assert.equal(syncSeats.mock.callCount(), 1);
  });

  it("audits membership.role_changed with a guard-verified principal for the target row", async () => {
    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m-1", userId: "user-b", orgId: "org-a", role: Role.MEMBER,
      status: "ACTIVE", createdAt: new Date(),
    })) as never;
    prisma.membership.update = mock.fn(async () => ({
      id: "m-1", role: Role.ADMIN, status: "ACTIVE", createdAt: new Date(),
      user: { id: "user-b", email: "b@example.test", name: null },
    })) as never;

    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction } as unknown as AuditService;
    const billing = { syncSeats: mock.fn(async () => undefined) } as unknown as BillingService;
    const service = new MembershipsService(audit, billing);
    await service.changeRole(tenant, "m-1", Role.ADMIN);

    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; principal: { kind: string; organizationId?: string };
    };
    assert.equal(call.action, "membership.role_changed");
    assert.deepEqual(call.principal, mintGuardVerifiedAuditPrincipal(tenant, "user-a"));
  });
});
