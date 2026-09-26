import {
  productMappingRecordSchema,
  resellPortalProductContractSchema,
} from "../resellportal-contract.schema";
import type {
  ProductMappingRecord,
  ResellPortalProductContract,
} from "../resellportal-contract.types";

export function createProductMappingFixture(
  overrides: Partial<ProductMappingRecord> = {},
): ProductMappingRecord {
  return productMappingRecordSchema.parse({
    gchSlug: "web-hosting",
    externalProductId: "rp-prod-1",
    externalProductKey: null,
    billingCycle: "monthly",
    approvedOrderDestination: "/storefront/verified/web-hosting",
    verificationStatus: "verified",
    purchaseEnabled: true,
    sourceEvidence: "verified-contract",
    ...overrides,
  });
}

export function createProductContractFixture(
  overrides: Partial<ResellPortalProductContract> = {},
): ResellPortalProductContract {
  return resellPortalProductContractSchema.parse({
    externalId: "rp-prod-1",
    name: "Web Hosting",
    billingCycles: ["monthly", "annual"],
    availability: "available",
    rawStatus: "active",
    ...overrides,
  });
}
