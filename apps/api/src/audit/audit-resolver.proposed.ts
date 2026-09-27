/**
 * SUPERSEDED 2026-09-27: the real Phase 4 contract and implementation are
 * audit-tenant-resolver.types.ts and audit-tenant-resolver.service.ts. This
 * file remains only as the design record referenced by
 * AUDIT-PHASE3-APPROVAL-CLOSURE.md; nothing imports it.
 *
 * PROPOSED contract only. No factory or production implementation exists.
 * Opaque brands prevent accidental structural construction in TypeScript;
 * they are NOT runtime authentication, and assertions can bypass them.
 * A reviewed server-only guard/PK resolver must mint these values later.
 */
declare const verifiedPrincipalBrand: unique symbol;
declare const serverBoundTargetBrand: unique symbol;
declare const approvedPairBrand: unique symbol;

export type ProposedVerifiedAuditPrincipal =
  | {
      readonly kind: "guard_verified_user";
      readonly userId: string;
      readonly organizationId: string;
      readonly [verifiedPrincipalBrand]: true;
    }
  | {
      readonly kind: "approved_system_job";
      readonly jobName: string;
      readonly [verifiedPrincipalBrand]: true;
    };

export interface ProposedServerBoundAuditTarget {
  readonly targetType: string;
  /** Internal primary key bound to the exact audited target by server code. */
  readonly targetId: string;
  readonly [serverBoundTargetBrand]: true;
}

export interface ProposedApprovedAuditPair {
  readonly action: string;
  readonly targetType: string;
  /** Minted only after an exact action–target pair is reviewed. */
  readonly [approvedPairBrand]: true;
}

export type ProposedSafeAuditReason =
  | "unsupported_pair"
  | "invalid_target"
  | "missing_proof"
  | "disagreeing_relations"
  | "membership_inactive"
  | "relation_unavailable";

export type ProposedScopeResolution =
  | { readonly kind: "resolved"; readonly orgId: string; readonly evidence: "server_bound_pk" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_member" }
  | { readonly kind: "deleted_target" }
  | { readonly kind: "conflict"; readonly candidates: number }
  | { readonly kind: "unsupported_shape"; readonly reason: ProposedSafeAuditReason }
  | { readonly kind: "malformed_evidence"; readonly reason: ProposedSafeAuditReason }
  | { readonly kind: "unavailable"; readonly retryable: boolean }
  | { readonly kind: "cross_tenant" };

/**
 * No caller-supplied organization override or relation-candidate list.
 * The eventual implementation must use a reviewed PK-bound read port,
 * enforce pair.targetType === target.targetType, compare every independent
 * authoritative relation, and verify principal provenance at runtime.
 * Exact action policy, system principal issuance, retry and write behavior
 * remain unapproved. Do not connect this interface to AuditService.
 */
export interface ProposedAuditTenantResolver {
  resolve(input: {
    readonly pair: ProposedApprovedAuditPair;
    readonly target: ProposedServerBoundAuditTarget;
    readonly principal: ProposedVerifiedAuditPrincipal;
  }): Promise<ProposedScopeResolution>;
}
