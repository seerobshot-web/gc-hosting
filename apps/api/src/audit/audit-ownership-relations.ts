import { prisma } from "@gch/database";
import type { AuditOwnershipRelation } from "./audit-ownership.plan";

export interface RelationLookupResult {
  found: boolean;
  organizationId?: string;
  relation?: AuditOwnershipRelation;
  /** Target row exists but its required relation join came back empty —
   *  a data-integrity anomaly, not an ordinary deletion. */
  relationUnavailable?: boolean;
}

export type RelationLookup = (targetId: string) => Promise<RelationLookupResult>;

/**
 * One PK-bound lookup per approved target type, shared by
 * AuditTenantResolverService (Phase 4, live writes) and
 * audit-ownership-scan.ts (Phase 7, offline historical classification).
 * Every path here is a single hop (direct id, or one join) to the row that
 * carries orgId — the schema has no target type with more than one
 * independently available relation, which is why `conflict` is not
 * reachable from either consumer (see audit-tenant-resolver.types.ts).
 */
export const RELATION_LOOKUP_BY_TARGET_TYPE: Readonly<Record<string, RelationLookup>> = {
  Org: async (targetId) => {
    const row = await prisma.org.findUnique({ where: { id: targetId }, select: { id: true } });
    return row ? { found: true, organizationId: row.id, relation: "org" } : { found: false };
  },
  OrgDomainVerification: async (targetId) => {
    const row = await prisma.orgDomainVerification.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row
      ? { found: true, organizationId: row.orgId, relation: "org_domain_verification" }
      : { found: false };
  },
  Membership: async (targetId) => {
    const row = await prisma.membership.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId, relation: "membership" } : { found: false };
  },
  Invitation: async (targetId) => {
    const row = await prisma.invitation.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId, relation: "invitation" } : { found: false };
  },
  Subscription: async (targetId) => {
    const row = await prisma.subscription.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId, relation: "subscription" } : { found: false };
  },
  Order: async (targetId) => {
    const row = await prisma.order.findUnique({ where: { id: targetId }, select: { orgId: true } });
    return row ? { found: true, organizationId: row.orgId, relation: "order" } : { found: false };
  },
  Invoice: async (targetId) => {
    const row = await prisma.invoice.findUnique({
      where: { id: targetId },
      select: { orgId: true },
    });
    return row ? { found: true, organizationId: row.orgId, relation: "invoice" } : { found: false };
  },
  ProviderService: async (targetId) => {
    const row = await prisma.providerService.findUnique({
      where: { id: targetId },
      select: { order: { select: { orgId: true } } },
    });
    if (!row) return { found: false };
    if (!row.order) return { found: true, relationUnavailable: true };
    return { found: true, organizationId: row.order.orgId, relation: "provider_service_order" };
  },
  ProvisioningOrder: async (targetId) => {
    const row = await prisma.provisioningOrder.findUnique({
      where: { id: targetId },
      select: { client: { select: { orgId: true } } },
    });
    if (!row) return { found: false };
    if (!row.client) return { found: true, relationUnavailable: true };
    return { found: true, organizationId: row.client.orgId, relation: "provisioning_order_client" };
  },
};
