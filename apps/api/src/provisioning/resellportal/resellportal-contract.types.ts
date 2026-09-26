export type VerificationStatus = "pending-verification" | "verified" | "disabled";

export type CatalogAvailability = "available" | "unavailable" | "unknown";

export type ProductMappingSourceEvidence = "missing-contract" | "verified-contract";

export interface ResellPortalProductContract {
  externalId: string;
  externalKey?: string;
  name: string;
  billingCycles: readonly string[];
  availability: CatalogAvailability;
  rawStatus: string;
}

export interface ProductMappingRecord {
  gchSlug: string;
  externalProductId: string | null;
  externalProductKey: string | null;
  billingCycle: string | null;
  approvedOrderDestination: string | null;
  verificationStatus: VerificationStatus;
  purchaseEnabled: boolean;
  sourceEvidence: ProductMappingSourceEvidence;
}

export interface VerifiedProductMapping extends ProductMappingRecord {
  externalProductId: string;
  externalProductKey: string | null;
  billingCycle: string;
  approvedOrderDestination: string;
  verificationStatus: "verified";
  purchaseEnabled: true;
  sourceEvidence: "verified-contract";
}

export type ContractGapFact =
  | "product-identifier-semantics"
  | "billing-cycle-semantics"
  | "availability-semantics"
  | "order-destination-allowlist"
  | "fulfillment-status-mapping"
  | "provisioning-status-mapping"
  | "idempotency-requirements"
  | "retry-safety"
  | "enabled-products-registry";

export interface ResellPortalContractGapDiagnostic {
  provider: "resellportal";
  gchSlug?: string;
  billingCycle?: string;
  missingFacts: readonly ContractGapFact[];
  verifiedFacts: readonly string[];
  summary: string;
}
