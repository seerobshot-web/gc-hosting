import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, PERMISSIONS, ROLES, type Permission } from "./index";

describe("permissions map", () => {
  it("every permission grants OWNER", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) {
      assert.equal(can("OWNER", p), true, p);
    }
  });

  it("MEMBER is read-only", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) {
      const expected = p.endsWith(":read");
      assert.equal(can("MEMBER", p), expected, p);
    }
  });

  it("ADMIN cannot manage billing or org settings", () => {
    assert.equal(can("ADMIN", "billing:manage"), false);
    assert.equal(can("ADMIN", "org:manage"), false);
    assert.equal(can("ADMIN", "member:invite"), true);
  });

  it("no role grants nothing", () => {
    assert.equal(can(null, "glink:read"), false);
    assert.equal(can(undefined, "glink:read"), false);
  });

  it("only known roles appear in the map", () => {
    for (const roles of Object.values(PERMISSIONS)) {
      for (const r of roles) assert.ok(ROLES.includes(r), r);
    }
  });
});
