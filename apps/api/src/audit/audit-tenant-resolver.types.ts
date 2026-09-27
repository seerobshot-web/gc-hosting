import type { TenantContext } from "../rbac/tenant.decorator";

/**
 * Real server-only contract for Phase 4, approved by
 * AUDIT-PHASE3-APPROVAL-RECORD.md. Opaque brands stop accidental structural
 * construction in TypeScript; they are NOT an authentication boundary on
 * their own — a type assertion can still bypass them. Only the mint
 * functions below may produce these values, and only AuditTenantResolverService
 * (audit-tenant-resolver.service.ts) may consume them.
 *
 * These are real `Symbol()` values, not `declare const ...: unique symbol`:
 * the mint functions construct actual objects at runtime, and a
 * type-only symbol declaration has no runtime value to key them with.
 */
const verifiedPrincipalBrand = Symbol("verifiedAuditPrincipal");
const serverBoundTargetBrand = Symbol("serverBoundAuditTarget");

/**
 * Job names allowed to mint a system-job audit principal. Every producer
 * that runs outside an authenticated request (a webhook handler, an
 * internal event listener, a cron job) is named here explicitly; adding a
 * name is itself a reviewed decision, not an implementation detail — see
 * the writer rollout order in AUDIT-PHASE3-APPROVAL-RECORD.md.
 */
const APPROVED_SYSTEM_JOB_NAMES: ReadonlySet<string> = new Set([
  "stripe.webhook",
  "provisioning.orchestrator",
  "cron.resellportal_poller",
  "cron.paid_order_recovery",
  "auth.auto_join",
  "billing.seat_sync",
]);

export class InvalidAuditPrincipalError extends Error {}

export type VerifiedAuditPrincipal =
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
    }
  | {
      /** invitation.accepted only: the invitee has a verified invitation
       *  token but not necessarily an existing membership/session. */
      readonly kind: "verified_invitation_token";
      readonly invitationId: string;
      readonly [verifiedPrincipalBrand]: true;
    }
  | {
      /**
       * `org.created` and the `auth.service.ts` auto-join path: there is no
       * pre-existing `TenantContext` because the Membership row this event
       * is about is the *first* one for this (userId, organizationId) pair,
       * created moments earlier in the same transaction the caller already
       * ran. Citing that just-written row is the ownership proof — there
       * is no "existing session org" to cross-check it against, so the
       * resolver does not run a cross-tenant comparison for this kind.
       */
      readonly kind: "verified_self_membership";
      readonly userId: string;
      readonly organizationId: string;
      readonly [verifiedPrincipalBrand]: true;
    };

export interface ServerBoundAuditTarget {
  readonly targetType: string;
  /** Internal primary key bound to the exact audited target by server code. */
  readonly targetId: string;
  readonly [serverBoundTargetBrand]: true;
}

/**
 * Structural mint from a guard-issued TenantContext. This only rejects a
 * TenantContext that is internally inconsistent (a guard bug) — it does not
 * itself decide business authorization. AuditTenantResolverService
 * re-checks membership fresh from the database before trusting it.
 */
export function mintGuardVerifiedAuditPrincipal(
  tenant: TenantContext,
  userId: string,
): VerifiedAuditPrincipal {
  if (
    !userId.trim() ||
    !tenant.orgId.trim() ||
    tenant.membership.userId !== userId ||
    tenant.membership.orgId !== tenant.orgId
  ) {
    throw new InvalidAuditPrincipalError(
      "TenantContext does not match the authenticated user",
    );
  }
  return {
    kind: "guard_verified_user",
    userId,
    organizationId: tenant.orgId,
    [verifiedPrincipalBrand]: true,
  };
}

export function mintApprovedSystemJobPrincipal(jobName: string): VerifiedAuditPrincipal {
  if (!APPROVED_SYSTEM_JOB_NAMES.has(jobName)) {
    throw new InvalidAuditPrincipalError(
      `"${jobName}" is not an approved system-job audit principal`,
    );
  }
  return { kind: "approved_system_job", jobName, [verifiedPrincipalBrand]: true };
}

/**
 * Mint from the Membership row the caller just created in this same
 * transaction/request — never from a TenantContext, and never for a
 * membership the caller merely looked up (that must go through
 * mintGuardVerifiedAuditPrincipal instead, which re-verifies freshness).
 */
export function mintVerifiedSelfMembershipPrincipal(
  membership: { userId: string; orgId: string },
): VerifiedAuditPrincipal {
  if (!membership.userId.trim() || !membership.orgId.trim()) {
    throw new InvalidAuditPrincipalError("userId and orgId are required");
  }
  return {
    kind: "verified_self_membership",
    userId: membership.userId,
    organizationId: membership.orgId,
    [verifiedPrincipalBrand]: true,
  };
}

export function mintVerifiedInvitationTokenPrincipal(
  invitationId: string,
): VerifiedAuditPrincipal {
  if (!invitationId.trim()) {
    throw new InvalidAuditPrincipalError("invitationId is required");
  }
  return {
    kind: "verified_invitation_token",
    invitationId,
    [verifiedPrincipalBrand]: true,
  };
}

export function mintServerBoundAuditTarget(
  targetType: string,
  targetId: string,
): ServerBoundAuditTarget {
  if (!targetType.trim() || !targetId.trim()) {
    throw new InvalidAuditPrincipalError("targetType and targetId are required");
  }
  return { targetType, targetId, [serverBoundTargetBrand]: true };
}

export type AuditScopeResolution =
  | { readonly kind: "resolved"; readonly organizationId: string }
  /**
   * Covers both "never existed" and "existed, now deleted": the schema has
   * no soft-delete marker, so a PK lookup cannot honestly distinguish them.
   * Rows 5 (`domain.removed`) and 8 (`membership.removed`) must resolve
   * *before* the delete completes (same transaction) precisely so this
   * path is never hit for them in normal operation — see the writer
   * rollout notes in AUDIT-PHASE3-APPROVAL-RECORD.md.
   */
  | { readonly kind: "not_found" }
  | { readonly kind: "not_member" }
  /**
   * Reserved for a future pair with more than one independently available
   * relation path. No pair among the 28 approved ones has more than one
   * under the current schema (every target is a single PK hop, at most one
   * join, to Org), so this is not producible by AuditTenantResolverService
   * today — see its spec for the explicit coverage note.
   */
  | { readonly kind: "conflict"; readonly candidates: number }
  | { readonly kind: "unsupported_shape"; readonly reason: "unsupported_pair" | "invalid_target" }
  | { readonly kind: "malformed_evidence"; readonly reason: "missing_proof" | "relation_unavailable" }
  | { readonly kind: "unavailable"; readonly retryable: boolean }
  | { readonly kind: "cross_tenant" };
