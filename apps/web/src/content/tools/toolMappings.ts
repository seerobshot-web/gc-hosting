import type { ToolMappingRecord } from "./toolTypes";

const pendingCatalogNote =
  "Order flow stays disabled until the upstream catalog contract verifies identifiers, availability semantics, and the approved storefront target.";

export const toolMappings: readonly ToolMappingRecord[] = [
  "business-website",
  "ai-website-builder",
  "web-hosting",
  "web-builder",
  "domain-registration",
  "plugin-theme-white-label",
  "managed-seo",
  "social-media-automation",
  "social-media-marketing",
  "reputation-review-management",
  "link-in-bio",
  "business-phone",
  "appointment-booking",
  "document-signing-platform",
  "windows-vpn",
  "esim-packages",
  "cpanel-email-file-management",
  "private-ai-box",
].map((slug) => ({
  slug,
  mappingStatus: "pending-contract" as const,
  upstreamProductKey: null,
  upstreamProductId: null,
  storefrontPath: null,
  orderEnabled: false,
  statusNote: pendingCatalogNote,
}));
