import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import { AuditOwnershipScanService } from "./audit-ownership-scan.service";

describe("AuditOwnershipScanService (Phase 7 dry-run wiring)", { concurrency: false }, () => {
  const originals = {
    findMany: prisma.auditLog.findMany,
    orgFindUnique: prisma.org.findUnique,
  };
  afterEach(() => {
    prisma.auditLog.findMany = originals.findMany;
    prisma.org.findUnique = originals.orgFindUnique;
  });

  it("classifies real rows via the shared relation lookups and performs no writes", async () => {
    const findMany = mock.fn(async ({ where }: { where: { orgId: null; id?: { gt: string } } }) => {
      if (where.id) return [];
      return [
        { id: "audit-1", action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null },
        { id: "audit-2", action: "org.updated", targetType: "Org", targetId: "org-missing", orgId: null },
      ];
    });
    prisma.auditLog.findMany = findMany as never;
    prisma.org.findUnique = mock.fn(async ({ where }: { where: { id: string } }) =>
      where.id === "org-a" ? { id: "org-a" } : null,
    ) as never;

    const service = new AuditOwnershipScanService();
    const summary = await service.runDryRun();

    assert.equal(summary.examined, 2);
    assert.equal(summary.resolved, 1);
    assert.equal(summary.orphaned, 1);
    assert.equal(summary.writesPerformed, 0);
    // Confirms it queries only orgId: null rows, never the whole table.
    assert.equal(findMany.mock.calls[0]!.arguments[0]!.where.orgId, null);
  });
});
