import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import { AuditOwnershipBackfillService } from "./audit-ownership-backfill.service";

describe("AuditOwnershipBackfillService (Phase 8 backfill wiring)", { concurrency: false }, () => {
  const originals = {
    findMany: prisma.auditLog.findMany,
    updateMany: prisma.auditLog.updateMany,
    orgFindUnique: prisma.org.findUnique,
  };
  afterEach(() => {
    prisma.auditLog.findMany = originals.findMany;
    prisma.auditLog.updateMany = originals.updateMany;
    prisma.org.findUnique = originals.orgFindUnique;
  });

  it("backfills a deterministic row with a guarded updateMany, and leaves an orphan untouched", async () => {
    prisma.auditLog.findMany = mock.fn(async () => [
      { id: "audit-1", action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null },
      { id: "audit-2", action: "org.updated", targetType: "Org", targetId: "org-missing", orgId: null },
    ]) as never;
    prisma.org.findUnique = mock.fn(async ({ where }: { where: { id: string } }) =>
      where.id === "org-a" ? { id: "org-a" } : null,
    ) as never;
    const updateMany = mock.fn(async (_args: unknown) => ({ count: 1 }));
    prisma.auditLog.updateMany = updateMany as never;

    const service = new AuditOwnershipBackfillService();
    const summary = await service.run();

    assert.equal(summary.examined, 2);
    assert.equal(summary.backfilled, 1);
    assert.equal(summary.orphaned, 1);
    assert.equal(updateMany.mock.callCount(), 1);
    assert.deepEqual(updateMany.mock.calls[0]!.arguments[0], {
      where: { id: "audit-1", orgId: null },
      data: { orgId: "org-a" },
    });
  });

  it("counts a guard miss (updateMany affected 0 rows) as skippedRace, not backfilled", async () => {
    prisma.auditLog.findMany = mock.fn(async () => [
      { id: "audit-1", action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null },
    ]) as never;
    prisma.org.findUnique = mock.fn(async () => ({ id: "org-a" })) as never;
    prisma.auditLog.updateMany = mock.fn(async (_args: unknown) => ({ count: 0 })) as never;

    const service = new AuditOwnershipBackfillService();
    const summary = await service.run();

    assert.equal(summary.backfilled, 0);
    assert.equal(summary.skippedRace, 1);
  });

  it("queries only orgId: null rows, never the whole table", async () => {
    const findMany = mock.fn(async (_args: unknown) => [] as unknown[]);
    prisma.auditLog.findMany = findMany as never;

    await new AuditOwnershipBackfillService().run();

    assert.equal((findMany.mock.calls[0]!.arguments[0] as { where: { orgId: null } }).where.orgId, null);
  });
});
