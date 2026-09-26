import { productMappingRecordSchema } from "./resellportal-contract.schema";
import type { ProductMappingRecord } from "./resellportal-contract.types";

export const approvedPhaseOneToolSlugs = [
  "business-website",
  "ai-website-builder",
  "web-hosting",
  "web-builder",
  "domain-registration",
  "plugin-theme-white-label",
  "managed-seo",
  "social-media-automation",
  "social-media-marketing",
  "reputation-reviews",
  "link-in-bio",
  "business-phone",
  "appointment-booking",
  "document-signing",
  "windows-vpn",
  "esim-packages",
  "cpanel-email-files",
  "private-ai-box",
] as const;

function createPendingMapping(gchSlug: string): ProductMappingRecord {
  return productMappingRecordSchema.parse({
    gchSlug,
    externalProductId: null,
    externalProductKey: null,
    billingCycle: null,
    approvedOrderDestination: null,
    verificationStatus: "pending-verification",
    purchaseEnabled: false,
    sourceEvidence: "missing-contract",
  });
}

export const resellPortalProductMappings = approvedPhaseOneToolSlugs.map(createPendingMapping);
