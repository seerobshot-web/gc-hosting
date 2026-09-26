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
  detailHref: string;
  contactHref: string;
  sourceLabel: string;
  lastReviewed: string;
}
