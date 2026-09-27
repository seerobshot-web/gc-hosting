import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIT_INTEGRITY_BATCH_SIZE,
  AUDIT_INTEGRITY_MAX_ORDERS,
  scanAuditIntegrity,
  type AuditIntegrityReader,
} from "./audit-integrity-scan";

function fixture(size: number, missing: readonly string[] = []) {
  const ids = Array.from({ length: size }, (_, index) => `order-${String(index).padStart(5, "0")}`);
  const limits: number[] = [];
  const lookupIds: string[] = [];
  const reader: AuditIntegrityReader = {
    async listDeployed(afterId, limit) {
      limits.push(limit);
      return ids.filter((id) => afterId === undefined || id > afterId)
        .slice(0, limit).map((id) => ({ id }));
    },
    async hasDeploymentAudit(orderId) {
      lookupIds.push(orderId);
      return !missing.includes(orderId);
    },
  };
  return { reader, limits, lookupIds, ids };
}

test("reports empty and small runs as complete without exposing IDs", async () => {
  assert.deepEqual(await scanAuditIntegrity(fixture(0).reader), {
    examined: 0, missingAudit: 0, incomplete: false,
  });
  const data = fixture(3, ["order-00001"]);
  assert.deepEqual(await scanAuditIntegrity(data.reader), {
    examined: 3, missingAudit: 1, incomplete: false,
  });
  assert.deepEqual(data.limits, [AUDIT_INTEGRITY_BATCH_SIZE]);
  assert.doesNotMatch(JSON.stringify(await scanAuditIntegrity(data.reader)), /order-/);
});

test("checks stable cursor pages and caps the full run even with more rows", async () => {
  const data = fixture(AUDIT_INTEGRITY_MAX_ORDERS + 20, ["order-00050"]);
  const result = await scanAuditIntegrity(data.reader);
  assert.deepEqual(result, { examined: AUDIT_INTEGRITY_MAX_ORDERS, missingAudit: 1, incomplete: true });
  assert.equal(data.lookupIds.length, AUDIT_INTEGRITY_MAX_ORDERS);
  assert.equal(new Set(data.lookupIds).size, AUDIT_INTEGRITY_MAX_ORDERS);
  assert.equal(Math.max(...data.limits), AUDIT_INTEGRITY_BATCH_SIZE);
  assert.equal(data.limits.at(-1), 1);
});

test("exactly the limit is complete after a bounded lookahead", async () => {
  const data = fixture(AUDIT_INTEGRITY_MAX_ORDERS);
  assert.equal((await scanAuditIntegrity(data.reader)).incomplete, false);
});

test("rejects non-advancing or oversized pages", async () => {
  await assert.rejects(
    scanAuditIntegrity({
      listDeployed: async () => [{ id: "a" }, { id: "a" }],
      hasDeploymentAudit: async () => true,
    }),
    /audit_integrity_invalid_cursor/,
  );
  await assert.rejects(
    scanAuditIntegrity({
      listDeployed: async (_cursor, limit) => Array.from({ length: limit + 1 }, () => ({ id: "a" })),
      hasDeploymentAudit: async () => true,
    }),
    /audit_integrity_invalid_batch/,
  );
});

test("propagates read failures without logging identifiers or writing", async () => {
  const reader: AuditIntegrityReader = {
    listDeployed: async () => [{ id: "private-id" }],
    hasDeploymentAudit: async () => { throw new Error("private-id secret"); },
  };
  await assert.rejects(scanAuditIntegrity(reader), /private-id secret/);
});
