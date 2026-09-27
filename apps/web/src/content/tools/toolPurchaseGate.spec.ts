import assert from "node:assert/strict";
import test from "node:test";
import { toolCatalog } from "./toolCatalog";
import { resolvePurchaseGate } from "./toolPurchaseGate";
import type { ToolMappingRecord } from "./toolTypes";

const baseMapping: ToolMappingRecord = {
  slug: "fixture-tool",
  mappingStatus: "pending-contract",
  upstreamProductKey: null,
  upstreamProductId: null,
  storefrontPath: null,
  orderEnabled: false,
  statusNote: "fixture",
};

test("every real catalog entry is blocked from Purchase today (all mappings are pending-contract)", () => {
  for (const tool of toolCatalog) {
    assert.equal(tool.purchase.canPurchase, false, tool.slug);
    assert.equal(tool.purchase.storefrontHref, null, tool.slug);
    assert.equal(tool.purchase.reason, "mapping_not_verified", tool.slug);
  }
});

test("a verified mapping with ordering enabled and a safe path can render Purchase", () => {
  const gate = resolvePurchaseGate({
    ...baseMapping,
    mappingStatus: "verified",
    orderEnabled: true,
    storefrontPath: "/checkout/fixture-tool",
  });
  assert.deepEqual(gate, {
    canPurchase: true,
    storefrontHref: "/checkout/fixture-tool",
    reason: "verified",
  });
});

test("a verified mapping with ordering still disabled cannot render Purchase", () => {
  const gate = resolvePurchaseGate({
    ...baseMapping,
    mappingStatus: "verified",
    orderEnabled: false,
    storefrontPath: "/checkout/fixture-tool",
  });
  assert.equal(gate.canPurchase, false);
  assert.equal(gate.reason, "ordering_disabled");
});

test("an unsafe or external storefront path is rejected even when verified and enabled", () => {
  for (const unsafePath of [
    "https://evil.example.com/checkout",
    "//evil.example.com/checkout",
    "javascript:alert(1)",
    // Backslash is treated as `/` for http(s) URLs by every browser's URL
    // parser, so these never literally start with `//` yet still resolve
    // cross-origin — a prefix-only check misses them.
    "/\\evil.example.com",
    "/\\\\evil.example.com",
    "/\\evil.example.com/checkout",
    "",
  ]) {
    const gate = resolvePurchaseGate({
      ...baseMapping,
      mappingStatus: "verified",
      orderEnabled: true,
      storefrontPath: unsafePath || null,
    });
    assert.equal(gate.canPurchase, false, unsafePath);
    assert.equal(gate.storefrontHref, null, unsafePath);
    assert.equal(gate.reason, "storefront_path_unsafe_or_missing", unsafePath);
  }
});

test("a missing storefront path on an otherwise-verified mapping is rejected, not silently allowed", () => {
  const gate = resolvePurchaseGate({
    ...baseMapping,
    mappingStatus: "verified",
    orderEnabled: true,
    storefrontPath: null,
  });
  assert.equal(gate.canPurchase, false);
  assert.equal(gate.reason, "storefront_path_unsafe_or_missing");
});
