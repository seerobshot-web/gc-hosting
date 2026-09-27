import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeAuditReadCursor, encodeAuditReadCursor } from "./audit-read-cursor";

describe("audit read cursor (Phase 8)", () => {
  it("round-trips createdAt and id exactly", () => {
    const createdAt = new Date("2026-03-14T09:26:53.589Z");
    const encoded = encodeAuditReadCursor({ createdAt, id: "audit-cuid-1" });
    const decoded = decodeAuditReadCursor(encoded);
    assert.ok(decoded);
    assert.equal(decoded!.createdAt.getTime(), createdAt.getTime());
    assert.equal(decoded!.id, "audit-cuid-1");
  });

  it("never encodes an orgId or any value beyond createdAt/id", () => {
    const encoded = encodeAuditReadCursor({ createdAt: new Date(), id: "audit-1" });
    assert.doesNotMatch(Buffer.from(encoded, "base64url").toString("utf8"), /org-/);
  });

  it("rejects malformed, empty, or non-cursor input instead of guessing", () => {
    for (const bad of ["", "not-base64!!", Buffer.from("no-separator-here").toString("base64url"),
      Buffer.from("|missing-date").toString("base64url"),
      Buffer.from("not-a-date|id-1").toString("base64url"),
      Buffer.from("2026-01-01T00:00:00.000Z|").toString("base64url")]) {
      assert.equal(decodeAuditReadCursor(bad), null);
    }
  });
});
