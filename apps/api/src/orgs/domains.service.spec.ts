import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";
import type { AuditService } from "../audit/audit.service";
import { mintGuardVerifiedAuditPrincipal } from "../audit/audit-tenant-resolver.types";
import type { TenantContext } from "../rbac/tenant.decorator";
import { DomainsService } from "./domains.service";

const tenant: TenantContext = {
  orgId: "org-a",
  membership: { userId: "user-a", orgId: "org-a", status: "ACTIVE" } as TenantContext["membership"],
};

describe("DomainsService audit wiring (Phase 6, Family 1)", { concurrency: false }, () => {
  const originals = {
    findUnique: prisma.orgDomainVerification.findUnique,
    transaction: prisma.$transaction,
  };
  afterEach(() => {
    prisma.orgDomainVerification.findUnique = originals.findUnique;
    prisma.$transaction = originals.transaction;
  });

  it("audits domain.removed with a guard-verified principal BEFORE the row is deleted, atomically", async () => {
    const order: string[] = [];
    prisma.orgDomainVerification.findUnique = mock.fn(async () => ({
      id: "dv-1", orgId: "org-a", domain: "example.test", dnsTxtToken: "t",
      verifiedAt: null, createdAt: new Date(),
    })) as never;

    const tx = {
      org: { updateMany: mock.fn(async () => { order.push("updateMany"); return { count: 1 }; }) },
      orgDomainVerification: { delete: mock.fn(async () => { order.push("delete"); }) },
    };
    prisma.$transaction = (async (cb: (t: unknown) => unknown) => cb(tx)) as never;

    const logAction = mock.fn(async (input: unknown, _db?: unknown) => {
      order.push("logAction");
      return input;
    });
    const audit = { logAction } as unknown as AuditService;
    const service = new DomainsService(audit);
    await service.remove(tenant, "dv-1");

    // The resolver's PK lookup must run — and the audit row must be
    // written — while the row still exists, and atomically with the
    // deletion: if anything later in the transaction fails, this write
    // must not have committed either.
    assert.deepEqual(order, ["logAction", "updateMany", "delete"]);

    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; organizationId?: string; userId?: string };
    };
    assert.equal(call.action, "domain.removed");
    assert.equal(call.targetType, "OrgDomainVerification");
    assert.equal(call.targetId, "dv-1");
    assert.deepEqual(call.principal, mintGuardVerifiedAuditPrincipal(tenant, "user-a"));
    // logAction's second argument must be the transaction client, not the
    // singleton — otherwise the atomicity this test exists to prove is void.
    assert.equal(logAction.mock.calls[0]!.arguments[1], tx);
  });

  it("rejects a domain that belongs to a different org before ever reaching the audit call", async () => {
    prisma.orgDomainVerification.findUnique = mock.fn(async () => ({
      id: "dv-1", orgId: "org-b", domain: "example.test", dnsTxtToken: "t",
      verifiedAt: null, createdAt: new Date(),
    })) as never;
    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction } as unknown as AuditService;
    const service = new DomainsService(audit);
    await assert.rejects(service.remove(tenant, "dv-1"), NotFoundException);
    assert.equal(logAction.mock.callCount(), 0);
  });
});
