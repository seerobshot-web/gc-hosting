import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@gch/database";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";
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

interface RelationLookupResult {
  found: boolean;
  organizationId?: string;
  /** Target row exists but its required relation join came back empty —
   *  a data-integrity anomaly, not an ordinary deletion. */
  relationUnavailable?: boolean;
}

type RelationLookup = (targetId: string) => Promise<RelationLookupResult>;

/**
 * One PK-bound lookup per approved target type. Every path here is a single
 * hop (direct id, or one join) to the row that carries orgId — the schema
 * has no target type with more than one independently available relation,
 * which is why `conflict` is not reachable from this map (see
 * audit-tenant-resolver.types.ts).
 */
const RELATION_LOOKUP_BY_TARGET_TYPE: Readonly<Record<string, RelationLookup>> = {
  Org: async (targetId) => {
    const row = await prisma.org.findUnique({ where: { id: targetId }, select: { id: true } });
    return row ? { found: true, organizationId: row.id } : { found: false };
  },
  OrgDomainVerification: async (targetId) => {
    const row = await prisma.orgDomainVerification.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId } : { found: false };
  },
  Membership: async (targetId) => {
    const row = await prisma.membership.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId } : { found: false };
  },
  Invitation: async (targetId) => {
    const row = await prisma.invitation.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId } : { found: false };
  },
  Subscription: async (targetId) => {
    const row = await prisma.subscription.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId } : { found: false };
  },
  Order: async (targetId) => {
    const row = await prisma.order.findUnique({ where: { id: targetId }, select: { orgId: true } });
    return row ? { found: true, organizationId: row.orgId } : { found: false };
  },
  Invoice: async (targetId) => {
    const row = await prisma.invoice.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId } : { found: false };
  },
  ProviderService: async (targetId) => {
    const row = await prisma.providerService.findUnique({
      where: { id: targetId },
      select: { order: { select: { orgId: true } } },
    });
    if (!row) return { found: false };
    if (!row.order) return { found: true, relationUnavailable: true };
    return { found: true, organizationId: row.order.orgId };
  },
  ProvisioningOrder: async (targetId) => {
    const row = await prisma.provisioningOrder.findUnique({
      where: { id: targetId },
      select: { client: { select: { orgId: true } } },
    });
    if (!row) return { found: false };
    if (!row.client) return { found: true, relationUnavailable: true };
    return { found: true, organizationId: row.client.orgId };
  },
};

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
