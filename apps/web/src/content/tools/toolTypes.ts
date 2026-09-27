export type ToolVerificationState = "verified" | "missing" | "unknown" | "stale" | "invalid";

export type ToolCategory =
  | "websites-hosting"
  | "marketing-growth"
  | "business-operations"
  | "infrastructure-advanced";

export interface ToolEditorialRecord {
  slug: string;
  displayName: string;
  category: ToolCategory;
  audience: string;
  teaser: string;
  summary: string;
  features: readonly string[];
  prerequisites: readonly string[];
  limitations: readonly string[];
  homepageFeatured?: boolean;
}

export type ToolMappingStatus = "verified" | "pending-contract" | "disabled";

export interface ToolMappingRecord {
  slug: string;
  mappingStatus: ToolMappingStatus;
  upstreamProductKey: string | null;
  upstreamProductId: string | null;
  storefrontPath: string | null;
  orderEnabled: boolean;
  statusNote: string;
}

export interface ToolField<T> {
  state: ToolVerificationState;
  value: T | null;
  note: string;
}

export type ToolPurchaseGateReason =
  | "mapping_not_verified"
  | "ordering_disabled"
  | "storefront_path_unsafe_or_missing"
  | "verified";

/** Whether a catalog entry may render a Purchase CTA — see toolPurchaseGate.ts. */
export interface ToolPurchaseGate {
  canPurchase: boolean;
  storefrontHref: string | null;
  reason: ToolPurchaseGateReason;
}

export interface ToolCardProjection {
  slug: string;
  displayName: string;
  category: ToolCategory;
  audience: string;
  teaser: string;
  summary: string;
  features: readonly string[];
  prerequisites: readonly string[];
  limitations: readonly string[];
  pricing: ToolField<string>;
  availability: ToolField<"Available" | "Contact us" | "Temporarily unavailable">;
  mapping: ToolMappingRecord;
  purchase: ToolPurchaseGate;
  detailHref: string;
  contactHref: string;
  sourceLabel: string;
  lastReviewed: string;
}
