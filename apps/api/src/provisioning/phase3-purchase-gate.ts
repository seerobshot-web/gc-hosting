import {
  assessEntitlementReadiness, correlationKey,
  type FulfillmentObservation, type PaymentObservation, type ProductEligibility,
} from "./phase3-contract-boundaries";
import {
  phase3Evidence, phase3PurchaseEnabled, productEvidence,
  type ContractArea, type ContractEvidence,
} from "./phase3-evidence.registry";

/** Normalized classifications, not Stripe or provider status values. */
export type PaymentSafety = "verified" | "missing" | "unknown" | "unsupported" | "stale" | "refunded" | "disputed";
export type FulfillmentSafety = "verified" | "missing" | "unknown" | "pending" | "retryable" | "terminal" | "unavailable";

export interface PurchaseGateInput {
  orderId: string;
  orgId: string;
  slug: string;
  product: ProductEligibility;
  payment: PaymentObservation;
  fulfillment: FulfillmentObservation;
  paymentSafety: PaymentSafety;
  fulfillmentSafety: FulfillmentSafety;
  destinationApproved: boolean;
  policyApproved: boolean;
  featureEnabled: boolean;
  contracts: Readonly<Record<Exclude<ContractArea, "product_mapping">, ContractEvidence>>;
}

export type PurchaseBlockReason =
  | "scope_mismatch" | "product_mapping_unapproved" | "destination_unapproved"
  | "payment_unverified" | "fulfillment_unverified" | "evidence_missing"
  | "contract_unapproved" | "entitlement_policy_unapproved" | "feature_disabled";

export interface PurchaseDecision {
  ready: boolean;
  status: "blocked";
  reason: PurchaseBlockReason;
  correlationKey: string;
}

/** Pure defensive preflight. It cannot authorize a purchase or grant an entitlement. */
export function assessPurchaseGate(input: PurchaseGateInput): PurchaseDecision {
  const blocked = (reason: PurchaseBlockReason): PurchaseDecision => ({
    ready: false, status: "blocked", reason,
    correlationKey: correlationKey(input.orderId, input.orgId),
  });
  if ([input.product, input.payment, input.fulfillment].some(
    (item) => item.orgId !== input.orgId || item.orderId !== input.orderId,
  )) return blocked("scope_mismatch");

  const mapping = productEvidence().find((item) => item.slug === input.slug);
  if (!mapping || mapping.status !== "verified" || !mapping.enabled || !input.product.approved) {
    return blocked("product_mapping_unapproved");
  }
  if (!mapping.destinationApproved || !input.destinationApproved) return blocked("destination_unapproved");
  if (input.paymentSafety !== "verified" || !input.payment.verified || input.payment.authority !== "stripe") {
    return blocked("payment_unverified");
  }
  if (input.fulfillmentSafety !== "verified" || !input.fulfillment.verified
    || input.fulfillment.authority !== "resellportal") return blocked("fulfillment_unverified");
  if (!input.product.mappingEvidenceRef?.trim() || !input.payment.evidenceRef?.trim()
    || !input.fulfillment.evidenceRef?.trim()) return blocked("evidence_missing");
  if (Object.values(input.contracts).some((contract) =>
    contract.status !== "verified" || !contract.approved || !contract.enabled)) {
    return blocked("contract_unapproved");
  }
  if (!input.policyApproved) return blocked("entitlement_policy_unapproved");
  if (!phase3PurchaseEnabled || !input.featureEnabled) return blocked("feature_disabled");
  // Retain the separate PR #57 evidence predicate as a defense in depth.
  const readiness = assessEntitlementReadiness(
    input.orderId, input.orgId, input.product, input.payment, input.fulfillment,
  );
  if (!readiness.ready) return blocked(
    readiness.reason === "scope_mismatch" ? "scope_mismatch" : "evidence_missing",
  );
  return blocked("feature_disabled");
}

/** Current production input is always unconfigured; no external adapter is attached. */
export function blockedPurchaseInput(
  orderId: string, orgId: string, slug = "",
): PurchaseGateInput {
  return {
    orderId, orgId, slug,
    product: { orderId, orgId, approved: false, mappingEvidenceRef: null },
    payment: { orderId, orgId, authority: "stripe", verified: false, evidenceRef: null },
    fulfillment: { orderId, orgId, authority: "resellportal", verified: false, evidenceRef: null },
    paymentSafety: "missing", fulfillmentSafety: "missing",
    destinationApproved: false, policyApproved: false, featureEnabled: false,
    contracts: phase3Evidence,
  };
}
