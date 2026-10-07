import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkoutBlockers, findDeal, canTransition } from "./index";
describe("prepaid safety gates", () => {
  it("kill switch and missing offers fail closed", () => {
    assert.deepEqual(checkoutBlockers(findDeal("brand-identity-development"), false, []), [
      "commerce_disabled",
    ]);
    assert.deepEqual(checkoutBlockers(undefined, true, []), ["unknown_deal"]);
  });
  it("an environment allowlist cannot enable an unresolved RP offer", () => {
    const reasons = checkoutBlockers(findDeal("seed-standard"), true, ["seed-standard"]);
    assert.ok(reasons.includes("rp_contract_unresolved"));
    assert.ok(reasons.includes("wholesale_prices_unresolved"));
  });
  it("human offer requires explicit allowlist", () => {
    assert.ok(
      checkoutBlockers(findDeal("brand-identity-development"), true, []).includes("deal_disabled"),
    );
    assert.deepEqual(
      checkoutBlockers(findDeal("brand-identity-development"), true, [
        "brand-identity-development",
      ]),
      [],
    );
  });
  it("unpaid, held and failed orders cannot gain access", () => {
    assert.equal(canTransition("CREATED", "ACTIVE"), false);
    assert.equal(canTransition("HELD", "ACTIVE"), false);
    assert.equal(canTransition("FAILED", "PROVISIONING"), false);
    assert.equal(canTransition("PROVISIONED", "ACTIVE"), true);
  });
});
