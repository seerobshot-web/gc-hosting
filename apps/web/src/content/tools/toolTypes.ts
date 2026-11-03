export type ToolVerificationState = "verified" | "missing" | "unknown" | "stale" | "invalid";

export type ToolCategory =
  | "websites-hosting"
  | "marketing-growth"
  | "business-operations"
  | "infrastructure-advanced";

export type ToolDemoStatus = "verified" | "unverified" | "unavailable" | "mapping-pending";
export type ToolPreviewMode = "workstation" | "device" | "infrastructure" | "service";

export interface ToolDemoRecord {
  slug: string;
  code: string;
  status: ToolDemoStatus;
  demoUrl: string | null;
  externalDemoUrl: string | null;
  clientAccessPath: string | null;
  documentationUrl: string | null;
  productDocumentationUrl: string | null;
  fulfillmentOnly: boolean;
  publicAllowlisted: boolean;
  previewMode: ToolPreviewMode;
  previewLabel: string;
  audience: readonly string[];
}

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
  demo: ToolDemoRecord;
  detailHref: string;
  contactHref: string;
  sourceLabel: string;
  lastReviewed: string;
}
