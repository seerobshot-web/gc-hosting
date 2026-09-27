import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import type { AuditService } from "../audit/audit.service";
import {
  mintGuardVerifiedAuditPrincipal,
  mintVerifiedSelfMembershipPrincipal,
} from "../audit/audit-tenant-resolver.types";
import type { TenantContext } from "../rbac/tenant.decorator";
import type { DomainsService } from "./domains.service";
import { OrgsService } from "./orgs.service";

describe("OrgsService audit wiring (Phase 6, Family 1)", { concurrency: false }, () => {
  const originals = {
    transaction: prisma.$transaction,
    findUnique: prisma.org.findUnique,
    update: prisma.org.update,
    findUniqueOrThrow: prisma.org.findUniqueOrThrow,
  };
  afterEach(() => {
    prisma.$transaction = originals.transaction;
    prisma.org.findUnique = originals.findUnique;
    prisma.org.update = originals.update;
    prisma.org.findUniqueOrThrow = originals.findUniqueOrThrow;
  });

  it("audits org.created with a self-membership principal — no TenantContext exists yet", async () => {
    prisma.org.findUnique = mock.fn(async () => null) as never;
    const tx = {
      org: { create: mock.fn(async () => ({ id: "org-new", name: "Fixture", slug: "fixture" })) },
      membership: { create: mock.fn(async () => ({ id: "m-1" })) },
    };
    prisma.$transaction = (async (cb: (t: unknown) => unknown) => cb(tx)) as never;

    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction } as unknown as AuditService;
    const service = new OrgsService(audit, {} as DomainsService);
    await service.create("user-a", "Fixture");

    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; organizationId?: string; userId?: string };
    };
    assert.equal(call.action, "org.created");
    assert.equal(call.targetType, "Org");
    assert.equal(call.targetId, "org-new");
    assert.deepEqual(
      call.principal,
      mintVerifiedSelfMembershipPrincipal({ userId: "user-a", orgId: "org-new" }),
    );
  });

  it("audits org.updated with a guard-verified principal bound to the caller's own org", async () => {
    const tenant: TenantContext = {
      orgId: "org-a",
      membership: { userId: "user-a", orgId: "org-a", status: "ACTIVE" } as TenantContext["membership"],
    };
    prisma.org.findUniqueOrThrow = mock.fn(async () => ({
      id: "org-a", name: "Old Name", slug: "old", autoJoinDomain: null,
      createdAt: new Date(), updatedAt: new Date(),
    })) as never;
    prisma.org.update = mock.fn(async () => ({
      id: "org-a", name: "New Name", slug: "old", autoJoinDomain: null,
      createdAt: new Date(), updatedAt: new Date(),
    })) as never;

    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction } as unknown as AuditService;
    const service = new OrgsService(audit, {} as DomainsService);
    await service.update(tenant, { name: "New Name" });

    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; organizationId?: string; userId?: string };
    };
    assert.equal(call.action, "org.updated");
    assert.equal(call.targetType, "Org");
    assert.equal(call.targetId, "org-a");
    assert.deepEqual(call.principal, mintGuardVerifiedAuditPrincipal(tenant, "user-a"));
  });
});
