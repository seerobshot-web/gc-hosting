import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIT_OWNERSHIP_SCAN_BATCH_SIZE,
  AUDIT_OWNERSHIP_SCAN_MAX_ROWS,
  scanAuditOwnership,
  type AuditOwnershipCandidateResolver,
  type AuditOwnershipScanReader,
  type AuditOwnershipScanRow,
} from "./audit-ownership-scan";

function rowsFixture(size: number): AuditOwnershipScanRow[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `audit-${String(index).padStart(6, "0")}`,
    action: "org.updated",
    targetType: "Org",
    targetId: `org-${index}`,
    orgId: null,
  }));
}

function readerFor(rows: readonly AuditOwnershipScanRow[]) {
  const limits: number[] = [];
  const reader: AuditOwnershipScanReader = {
    async listNullScoped(afterId, limit) {
      limits.push(limit);
      return rows
        .filter((r) => afterId === undefined || r.id > afterId)
        .slice(0, limit);
    },
  };
  return { reader, limits };
}

const alwaysResolved: AuditOwnershipCandidateResolver = async (row) => [
  { organizationId: `org-for-${row.targetId}`, relation: "org", evidenceReference: row.targetId },
];

test("reports an empty run as complete with all-zero buckets", async () => {
  const { reader } = readerFor([]);
  assert.deepEqual(await scanAuditOwnership(reader, alwaysResolved), {
    examined: 0, alreadyScoped: 0, resolved: 0, conflict: 0, orphaned: 0,
    unsupported: 0, invalid: 0, unavailable: 0, incomplete: false, writesPerformed: 0,
  });
});

test("classifies each bucket correctly and never writes", async () => {
  const rows = rowsFixture(5);
  const { reader } = readerFor(rows);
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
  // Row 4 gets an unsupported target type to exercise that bucket.
  rows[4]!.targetType = "SomeFutureType";

  const summary = await scanAuditOwnership(reader, resolver);
  assert.equal(summary.examined, 5);
  assert.equal(summary.resolved, 1); // org-0
  assert.equal(summary.conflict, 1); // org-1
  assert.equal(summary.orphaned, 1); // org-2
  assert.equal(summary.unavailable, 1); // org-3
  assert.equal(summary.unsupported, 1); // row 4
  assert.equal(summary.writesPerformed, 0);
  assert.equal(summary.incomplete, false);
});

test("paginates with a stable cursor and caps the full run even with more rows", async () => {
  const { reader, limits } = readerFor(rowsFixture(AUDIT_OWNERSHIP_SCAN_MAX_ROWS + 25));
  const summary = await scanAuditOwnership(reader, alwaysResolved);
  assert.equal(summary.examined, AUDIT_OWNERSHIP_SCAN_MAX_ROWS);
  assert.equal(summary.incomplete, true);
  assert.equal(Math.max(...limits), AUDIT_OWNERSHIP_SCAN_BATCH_SIZE);
  assert.equal(limits.at(-1), 1); // the bounded lookahead read
});

test("is idempotent: a full re-scan of unchanged data is fully deterministic", async () => {
  // This module has no persisted-cursor resume API — it re-derives its
  // classification from `orgId IS NULL` on every call, which is what makes
  // repeated runs safe: no state to get out of sync, and no write to
  // duplicate. Restartability here means "safe to run again from scratch,"
  // not "resumes mid-scan."
  const rows = rowsFixture(10);
  const { reader } = readerFor(rows);
  const seen: string[] = [];
  const resolver: AuditOwnershipCandidateResolver = async (row) => {
    seen.push(row.id);
    return [{ organizationId: "org-x", relation: "org", evidenceReference: row.targetId }];
  };
  const first = await scanAuditOwnership(reader, resolver);
  const firstSeen = [...seen];
  seen.length = 0;
  const second = await scanAuditOwnership(reader, resolver);
  assert.deepEqual(first, second);
  assert.equal(second.examined, 10);
  assert.deepEqual(seen, firstSeen);
});

test("rejects non-advancing or oversized pages", async () => {
  await assert.rejects(
    scanAuditOwnership(
      {
        listNullScoped: async () => [
          { id: "a", action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null },
          { id: "a", action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null },
        ],
      },
      alwaysResolved,
    ),
    /audit_ownership_scan_invalid_cursor/,
  );
  await assert.rejects(
    scanAuditOwnership(
      {
        listNullScoped: async (_cursor, limit) =>
          Array.from({ length: limit + 1 }, (_v, i) => ({
            id: `a-${i}`, action: "org.updated", targetType: "Org", targetId: "org-a", orgId: null,
          })),
      },
      alwaysResolved,
    ),
    /audit_ownership_scan_invalid_batch/,
  );
});

test("the summary contains no per-row identifiers", async () => {
  const rows = rowsFixture(3);
  const { reader } = readerFor(rows);
  const summary = await scanAuditOwnership(reader, alwaysResolved);
  assert.doesNotMatch(JSON.stringify(summary), /audit-|org-/);
});
