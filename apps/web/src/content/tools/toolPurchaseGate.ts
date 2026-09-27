import type { ToolMappingRecord, ToolPurchaseGate } from "./toolTypes";

/**
 * Phase 9 — whether a catalog entry may render a Purchase CTA at all, and
 * where it would point. Every one of the 18 current entries has
 * `mappingStatus: "pending-contract"`, so this always resolves to
 * `canPurchase: false` today; the branch exists and is tested so a future
 * verified mapping doesn't require touching page markup, and so an unsafe
 * or external `storefrontPath` is rejected even if a mapping record were
 * ever misconfigured.
 */
export function resolvePurchaseGate(mapping: ToolMappingRecord): ToolPurchaseGate {
  if (mapping.mappingStatus !== "verified") {
    return { canPurchase: false, storefrontHref: null, reason: "mapping_not_verified" };
  }
  if (!mapping.orderEnabled) {
    return { canPurchase: false, storefrontHref: null, reason: "ordering_disabled" };
  }
  if (!isSafeStorefrontPath(mapping.storefrontPath)) {
    return { canPurchase: false, storefrontHref: null, reason: "storefront_path_unsafe_or_missing" };
  }
  return { canPurchase: true, storefrontHref: mapping.storefrontPath, reason: "verified" };
}

/**
 * Only a same-origin relative path is ever an acceptable storefront target
 * — never absolute (`https://...`), protocol-relative (`//...`), or a
 * scheme that isn't a plain path (`javascript:`, `data:`, etc.). This is
 * the allowlist the "unsafe redirect rejection" requirement calls for.
 */
function isSafeStorefrontPath(path: string | null): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}
