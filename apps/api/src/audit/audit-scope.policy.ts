import type { TenantContext } from "../rbac/tenant.decorator";
import {
  classifyAuditOwnership,
  type AuditOwnershipEvidence,
} from "./audit-ownership.plan";

/**
 * A future writer must supply this allowlist from a separately approved
 * action–target policy. There is deliberately no production default.
 */
export type ApprovedAuditActionTargets = ReadonlySet<string>;

export function auditActionTargetKey(action: string, targetType: string): string {
  return `${action}\u0000${targetType}`;
}

export interface AuthorizedAuditScopeInput {
  /** Authenticated server-side user id, never the actor display string. */
  userId: string;
  /** Supplied by RolesGuard after requireMembership; not a request DTO. */
  tenant?: TenantContext;
  action: string;
  targetType: string;
  targetId: string;
  /** Resolver-proven GCH relations only, never metadata or a provider id. */
  candidates: readonly AuditOwnershipEvidence[];
  approvedActionTargets: ApprovedAuditActionTargets;
}

export type AuthorizedAuditScopeResult =
  | { status: "verified"; organizationId: string }
  | {
      status: "denied";
      reason:
        | "missing_scope"
        | "unauthorized_scope"
        | "unsupported_event_shape"
        | "invalid"
        | "orphaned"
        | "ambiguous";
    };

/**
 * Pure preparatory policy check. No production allowlist or DB resolver exists
 * yet, so no active writer calls this function or persists its result.
 * TenantContext must come from RolesGuard, and relation evidence from a
 * separately reviewed server-side resolver. TypeScript alone is not an
 * authentication boundary.
 */
export function resolveAuthorizedAuditScope(
  input: AuthorizedAuditScopeInput,
): AuthorizedAuditScopeResult {
  if (!input.tenant) return { status: "denied", reason: "missing_scope" };
  if (
    !input.userId.trim() ||
    !input.tenant.orgId.trim() ||
    input.tenant.membership.userId !== input.userId ||
    input.tenant.membership.orgId !== input.tenant.orgId ||
    input.tenant.membership.status !== "ACTIVE"
  ) {
    return { status: "denied", reason: "unauthorized_scope" };
  }
  if (![input.action, input.targetType, input.targetId].every((s) => s.trim())) {
    return { status: "denied", reason: "invalid" };
  }
  if (!input.approvedActionTargets.has(
    auditActionTargetKey(input.action, input.targetType),
  )) {
    return { status: "denied", reason: "unsupported_event_shape" };
  }

  const candidate = classifyAuditOwnership({
    auditId: "scope-check",
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    candidates: input.candidates,
  });
  switch (candidate.classification) {
    case "authoritatively_attributable":
      return candidate.organizationId === input.tenant.orgId
        ? { status: "verified", organizationId: input.tenant.orgId }
        : { status: "denied", reason: "unauthorized_scope" };
    case "ambiguous":
      return { status: "denied", reason: "ambiguous" };
    case "orphaned":
      return { status: "denied", reason: "orphaned" };
    case "invalid":
      return { status: "denied", reason: "invalid" };
    case "unsupported_event_shape":
      return { status: "denied", reason: "unsupported_event_shape" };
    case "already_scoped":
      // No persisted tenant key is supplied to this pre-migration helper.
      return { status: "denied", reason: "ambiguous" };
  }
}
