import { createHash } from "node:crypto";

/**
 * Internal, normalized evidence only. These are NOT upstream API shapes.
 * No production adapter implements these ports until its contract is approved.
 */
export interface EvidenceScope {
  orderId: string;
  orgId: string;
  evidenceRef: string | null;
}

export interface PaymentObservation extends EvidenceScope {
  authority: "stripe";
  verified: boolean;
}

export interface FulfillmentObservation extends EvidenceScope {
  authority: "resellportal";
  verified: boolean;
}

export interface ProductEligibility {
  orderId: string;
  orgId: string;
  approved: boolean;
  mappingEvidenceRef: string | null;
}

export interface PaymentVerificationPort {
  verify(orderId: string, orgId: string): Promise<PaymentObservation>;
}

export interface FulfillmentVerificationPort {
  verify(orderId: string, orgId: string): Promise<FulfillmentObservation>;
}

export interface ProductEligibilityPort {
  check(orderId: string, orgId: string): Promise<ProductEligibility>;
}

export type ReadinessReason =
  | "product_unapproved"
  | "payment_unverified"
  | "fulfillment_unverified"
  | "scope_mismatch"
  | "evidence_missing"
  | "ready";

export interface EntitlementReadiness {
  ready: boolean;
  reason: ReadinessReason;
  correlationKey: string;
}

/** Stable internal correlation identity; never an assertion of provider idempotency. */
export function correlationKey(orderId: string, orgId: string): string {
  return createHash("sha256").update(`gch:phase3:${orgId}:${orderId}`).digest("hex");
}

/**
 * Pure readiness assessment, never an entitlement grant.
 * A local PAID flag and a provider's unvalidated response cannot be passed in
 * place of independent, scoped verification observations.
 */
export function assessEntitlementReadiness(
  orderId: string,
  orgId: string,
  product: ProductEligibility,
  payment: PaymentObservation,
  fulfillment: FulfillmentObservation,
): EntitlementReadiness {
  const blocked = (reason: ReadinessReason): EntitlementReadiness => ({
    ready: false, reason, correlationKey: correlationKey(orderId, orgId),
  });

  if (
    [product, payment, fulfillment].some(
      (item) => item.orderId !== orderId || item.orgId !== orgId,
    )
  ) return blocked("scope_mismatch");
  if (!product.approved) return blocked("product_unapproved");
  if (!payment.verified || payment.authority !== "stripe") return blocked("payment_unverified");
  if (!fulfillment.verified || fulfillment.authority !== "resellportal") {
    return blocked("fulfillment_unverified");
  }
  if (
    !product.mappingEvidenceRef?.trim() ||
    !payment.evidenceRef?.trim() ||
    !fulfillment.evidenceRef?.trim()
  ) return blocked("evidence_missing");

  return { ready: true, reason: "ready", correlationKey: correlationKey(orderId, orgId) };
}

/** Explicitly unverified defaults for test-only and unconfigured adapters. */
export function unconfiguredObservations(orderId: string, orgId: string) {
  return {
    product: { orderId, orgId, approved: false, mappingEvidenceRef: null },
    payment: { orderId, orgId, authority: "stripe" as const, verified: false, evidenceRef: null },
    fulfillment: {
      orderId, orgId, authority: "resellportal" as const, verified: false, evidenceRef: null,
    },
  };
}
