import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@gch/database";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";
import { RELATION_LOOKUP_BY_TARGET_TYPE } from "./audit-ownership-relations";
import { auditActionTargetKey } from "./audit-scope.policy";
import type {
  AuditScopeResolution,
  ServerBoundAuditTarget,
  VerifiedAuditPrincipal,
} from "./audit-tenant-resolver.types";

/**
 * Exactly the 28 pairs approved in AUDIT-PHASE3-APPROVAL-RECORD.md. Adding a
 * pair here is itself a reviewed decision, not an implementation detail.
 */
const APPROVED_AUDIT_PAIRS: ReadonlySet<string> = new Set([
  auditActionTargetKey("org.created", "Org"),
  auditActionTargetKey("org.updated", "Org"),
  auditActionTargetKey("domain.added", "OrgDomainVerification"),
  auditActionTargetKey("domain.verified", "OrgDomainVerification"),
  auditActionTargetKey("domain.removed", "OrgDomainVerification"),
  auditActionTargetKey("membership.created", "Membership"),
  auditActionTargetKey("membership.role_changed", "Membership"),
  auditActionTargetKey("membership.removed", "Membership"),
  auditActionTargetKey("invitation.sent", "Invitation"),
  auditActionTargetKey("invitation.resent", "Invitation"),
  auditActionTargetKey("invitation.revoked", "Invitation"),
  auditActionTargetKey("invitation.accepted", "Invitation"),
  auditActionTargetKey("subscription.seats_synced", "Subscription"),
  auditActionTargetKey("billing.checkout_started", "Org"),
  auditActionTargetKey("order.paid", "Order"),
  auditActionTargetKey("order.cancelled", "Order"),
  auditActionTargetKey("order.transition_rejected", "Order"),
  auditActionTargetKey("subscription.status_changed", "Subscription"),
  auditActionTargetKey("invoice.paid", "Invoice"),
  auditActionTargetKey("invoice.payment_failed", "Invoice"),
  auditActionTargetKey("service.provisioned", "ProviderService"),
  auditActionTargetKey("service.provisioning_failed", "ProviderService"),
  auditActionTargetKey("service.suspended", "ProviderService"),
  auditActionTargetKey("service.terminated", "ProviderService"),
  auditActionTargetKey("order.placed", "ProvisioningOrder"),
  auditActionTargetKey("order.failed", "ProvisioningOrder"),
  auditActionTargetKey("order.deployed", "ProvisioningOrder"),
  auditActionTargetKey("order.recovery_review_required", "Order"),
]);

/**
 * Server-only authoritative resolver. Proves tenant ownership from a
 * PK-bound relational lookup — never from actor strings, free-form
 * metadata, browser input, or a caller-supplied organization id. No writer
 * calls this yet (Phase 6); this phase only implements and tests it.
 */
@Injectable()
export class AuditTenantResolverService {
  private readonly logger = new Logger(AuditTenantResolverService.name);

  async resolve(input: {
    action: string;
    target: ServerBoundAuditTarget;
    principal: VerifiedAuditPrincipal;
  }): Promise<AuditScopeResolution> {
    const { action, target, principal } = input;

    if (!APPROVED_AUDIT_PAIRS.has(auditActionTargetKey(action, target.targetType))) {
      return { kind: "unsupported_shape", reason: "unsupported_pair" };
    }

    const lookup = RELATION_LOOKUP_BY_TARGET_TYPE[target.targetType];
    if (!lookup) {
      return { kind: "unsupported_shape", reason: "invalid_target" };
    }

    if (principal.kind === "guard_verified_user") {
      const membership = await this.safeLookup(() =>
        prisma.membership.findUnique({
          where: {
            userId_orgId: { userId: principal.userId, orgId: principal.organizationId },
          },
        }),
      );
      if (membership === "unavailable") return { kind: "unavailable", retryable: true };
      if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
        return { kind: "not_member" };
      }
    }

    const result = await this.safeLookup(() => lookup(target.targetId));
    if (result === "unavailable") return { kind: "unavailable", retryable: true };
    if (!result.found) return { kind: "not_found" };
    if (result.relationUnavailable || !result.organizationId) {
      return { kind: "malformed_evidence", reason: "relation_unavailable" };
    }

    if (
      principal.kind === "guard_verified_user" &&
      result.organizationId !== principal.organizationId
    ) {
      return { kind: "cross_tenant" };
    }

    return { kind: "resolved", organizationId: result.organizationId };
  }

  /** Read-only: never persists. Any DB error fails closed as retryable. */
  private async safeLookup<T>(fn: () => Promise<T>): Promise<T | "unavailable"> {
    try {
      return await fn();
    } catch (err) {
      this.logger.error(
        `audit tenant resolver lookup failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return "unavailable";
    }
  }
}
