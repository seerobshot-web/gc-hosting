import { resellPortalProductMappings } from "./resellportal/resellportal-mapping.registry";
import type { ProductMappingRecord } from "./resellportal/resellportal-contract.types";

export type EvidenceStatus = "verified" | "assumption" | "unresolved";
export type ContractArea =
  | "product_mapping" | "destination" | "stripe_payment"
  | "resellportal_catalog" | "resellportal_fulfillment"
  | "resellportal_idempotency" | "resellportal_retry"
  | "entitlement_policy";

export interface ContractEvidence {
  area: ContractArea;
  status: EvidenceStatus;
  fact: string;
  assumption: string | null;
  blocker: string | null;
  approved: boolean;
  enabled: boolean;
}

/** Inventory derived from the existing mapping registry, never a second SKU registry. */
export function productEvidence(
  mappings: readonly ProductMappingRecord[] = resellPortalProductMappings,
) {
  return mappings.map((mapping) => ({
    slug: mapping.gchSlug,
    status: mapping.verificationStatus === "verified" && mapping.sourceEvidence === "verified-contract"
      ? "verified" as const : "unresolved" as const,
    destinationApproved: mapping.verificationStatus === "verified"
      && Boolean(mapping.approvedOrderDestination),
    enabled: mapping.purchaseEnabled,
    blocker: mapping.purchaseEnabled ? null : "product_mapping_unapproved" as const,
  }));
}

/** Current external approvals; static disabled values prevent environment-only enablement. */
export const phase3Evidence: Readonly<Record<Exclude<ContractArea, "product_mapping">, ContractEvidence>> = {
  destination: { area: "destination", status: "unresolved", fact: "Destinations are null in the mapping registry.", assumption: null, blocker: "destination_unapproved", approved: false, enabled: false },
  stripe_payment: { area: "stripe_payment", status: "unresolved", fact: "Signed webhook handling exists.", assumption: "Local PAID could follow checkout completion.", blocker: "payment_contract_unapproved", approved: false, enabled: false },
  resellportal_catalog: { area: "resellportal_catalog", status: "unresolved", fact: "The public catalog is an editorial allowlist.", assumption: null, blocker: "catalog_contract_unapproved", approved: false, enabled: false },
  resellportal_fulfillment: { area: "resellportal_fulfillment", status: "unresolved", fact: "Provider fixtures are synthetic.", assumption: null, blocker: "fulfillment_contract_unapproved", approved: false, enabled: false },
  resellportal_idempotency: { area: "resellportal_idempotency", status: "unresolved", fact: "Local correlation keys exist.", assumption: "The provider may honor an idempotency header.", blocker: "idempotency_contract_unapproved", approved: false, enabled: false },
  resellportal_retry: { area: "resellportal_retry", status: "unresolved", fact: "Recovery records operator review only.", assumption: null, blocker: "retry_contract_unapproved", approved: false, enabled: false },
  entitlement_policy: { area: "entitlement_policy", status: "unresolved", fact: "Readiness assessment has no grant side effect.", assumption: null, blocker: "entitlement_policy_unapproved", approved: false, enabled: false },
};

/** No approved rollout switch exists; disabled regardless of environment input. */
export const phase3PurchaseEnabled = false;
