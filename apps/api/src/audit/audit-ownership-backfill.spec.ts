import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIT_OWNERSHIP_BACKFILL_BATCH_SIZE,
  AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS,
  backfillAuditOwnership,
  type AuditOwnershipBackfillReader,
  type AuditOwnershipBackfillRow,
  type AuditOwnershipCandidateResolver,
  type AuditOwnershipGuardedWriter,
} from "./audit-ownership-backfill";

function rowsFixture(size: number): AuditOwnershipBackfillRow[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `audit-${String(index).padStart(6, "0")}`,
    action: "org.updated",
    targetType: "Org",
    targetId: `org-${index}`,
    orgId: null,
  }));
}

function readerFor(rows: readonly AuditOwnershipBackfillRow[]) {
  const limits: number[] = [];
  const reader: AuditOwnershipBackfillReader = {
    async listNullScoped(afterId, limit) {
      limits.push(limit);
      return rows.filter((r) => afterId === undefined || r.id > afterId).slice(0, limit);
    },
  };
  return { reader, limits };
}

const alwaysResolved: AuditOwnershipCandidateResolver = async (row) => [
  { organizationId: `org-for-${row.targetId}`, relation: "org", evidenceReference: row.targetId },
];

test("writes only deterministic rows, and never conflict/orphan/unsupported/invalid/unavailable ones", async () => {
  const rows = rowsFixture(6);
  const { reader } = readerFor(rows);
  const written: { id: string; organizationId: string }[] = [];
  const write: AuditOwnershipGuardedWriter = async (row, organizationId) => {
    written.push({ id: row.id, organizationId });
    return true;
  };
  const resolver: AuditOwnershipCandidateResolver = async (row) => {
    switch (row.targetId) {
      case "org-0": return [{ organizationId: "org-x", relation: "org", evidenceReference: row.targetId }];
      case "org-1": return [
        { organizationId: "org-x", relation: "org", evidenceReference: row.targetId },
        { organizationId: "org-y", relation: "org", evidenceReference: row.targetId },
      ];
      case "org-2": return [];
      case "org-3": return "unavailable";
      default: return [];
    }
  };
  rows[5]!.targetType = "SomeFutureType";

  const summary = await backfillAuditOwnership(reader, resolver, write);
  assert.equal(summary.examined, 6);
  assert.equal(summary.backfilled, 1); // org-0 only
  assert.equal(summary.conflict, 1); // org-1
  assert.equal(summary.orphaned, 2); // org-2, and org-4 (falls through to the default empty case)
  assert.equal(summary.unavailable, 1); // org-3
  assert.equal(summary.unsupported, 1); // row 5
  assert.deepEqual(written, [{ id: "audit-000000", organizationId: "org-x" }]);
});

test("counts a raced write (guard returned false) as skippedRace, not backfilled", async () => {
  const rows = rowsFixture(1);
  const { reader } = readerFor(rows);
  const write: AuditOwnershipGuardedWriter = async () => false; // simulates a concurrent writer winning
  const summary = await backfillAuditOwnership(reader, alwaysResolved, write);
  assert.equal(summary.backfilled, 0);
  assert.equal(summary.skippedRace, 1);
});

test("paginates with a stable cursor and caps the full run", async () => {
  const { reader, limits } = readerFor(rowsFixture(AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS + 25));
  const summary = await backfillAuditOwnership(reader, alwaysResolved, async () => true);
  assert.equal(summary.examined, AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS);
  assert.equal(summary.backfilled, AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS);
  assert.equal(summary.incomplete, true);
  assert.equal(Math.max(...limits), AUDIT_OWNERSHIP_BACKFILL_BATCH_SIZE);
});

test("rejects non-advancing or oversized pages", async () => {
  await assert.rejects(
    backfillAuditOwnership(
      {
        listNullScoped: async () => [
          { id: "a", action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null },
          { id: "a", action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null },
        ],
      },
      alwaysResolved,
      async () => true,
    ),
    /audit_ownership_backfill_invalid_cursor/,
  );
  await assert.rejects(
    backfillAuditOwnership(
      {
        listNullScoped: async (_cursor, limit) =>
          Array.from({ length: limit + 1 }, (_v, i) => ({
            id: `a-${i}`, action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null,
          })),
      },
      alwaysResolved,
      async () => true,
    ),
    /audit_ownership_backfill_invalid_batch/,
  );
});

test("is idempotent: re-running after every row is backfilled examines nothing new", async () => {
  const rows = rowsFixture(4);
  const backfilledIds = new Set<string>();
  // Simulates the reader's own real-world guard: once orgId is set, the
  // row drops out of the `orgId IS NULL` result set entirely.
  const reader: AuditOwnershipBackfillReader = {
    async listNullScoped(afterId, limit) {
      return rows
        .filter((r) => !backfilledIds.has(r.id))
        .filter((r) => afterId === undefined || r.id > afterId)
        .slice(0, limit);
    },
  };
  const write: AuditOwnershipGuardedWriter = async (row) => {
    backfilledIds.add(row.id);
    return true;
  };

  const first = await backfillAuditOwnership(reader, alwaysResolved, write);
  assert.equal(first.backfilled, 4);

  const second = await backfillAuditOwnership(reader, alwaysResolved, write);
  assert.equal(second.examined, 0);
  assert.equal(second.backfilled, 0);
});
