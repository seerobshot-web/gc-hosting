/**
 * Fixture-only audit ownership planning. This module never reads or writes a
 * database. A resolver must prove candidates from schema-enforced relations
 * before any future production dry run may supply them.
 */
export type AuditTenantClassification =
  | "already_scoped"
  | "authoritatively_attributable"
  | "ambiguous"
  | "orphaned"
  | "invalid"
  | "unsupported_event_shape";

export type AuditOwnershipRelation =
  | "org"
  | "order"
  | "provider_service_order"
  | "client"
  | "provisioning_order_client"
  | "glink"
  | "subscription"
  | "invoice"
  | "invitation"
  | "membership"
  | "org_domain_verification";

export interface AuditOwnershipEvidence {
  organizationId: string;
  relation: AuditOwnershipRelation;
  /** Internal relation proof reference, never a provider or payment identifier. */
  evidenceReference: string;
}

export interface AuditOwnershipFixture {
  auditId: string;
  action: string;
  targetType: string;
  targetId: string;
  /** Future schema field, absent on current AuditLog rows. */
  existingOrganizationId?: string | null;
  /** Must be supplied by a verified relational resolver, never audit metadata. */
  candidates: readonly AuditOwnershipEvidence[];
}

export type AuditOwnershipReason =
  | "already_scoped"
  | "single_authoritative_relation"
  | "conflicting_organizations"
  | "tenant_mismatch"
  | "target_missing"
  | "malformed_audit_row"
  | "unsupported_target";

export interface AuditBackfillCandidate {
  auditId: string;
  classification: AuditTenantClassification;
  organizationId?: string;
  evidenceReference?: string;
  safeReasonCode: AuditOwnershipReason;
}

export interface AuditBackfillDryRunReport {
  examined: number;
  alreadyScoped: number;
  attributable: number;
  ambiguous: number;
  orphaned: number;
  invalid: number;
  unsupported: number;
  manualReviewRequired: number;
  projectedIndexes: readonly string[];
  writesPerformed: 0;
}

const supportedTargets: ReadonlySet<string> = new Set([
  "Org", "Order", "ProviderService", "Client", "ProvisioningOrder",
  "GLink", "Subscription", "Invoice", "Invitation", "Membership",
  "OrgDomainVerification",
]);

/** Reject metadata/actor guesses: only separately resolved relation proofs are inputs. */
export function classifyAuditOwnership(row: AuditOwnershipFixture): AuditBackfillCandidate {
  const candidate = (
    classification: AuditTenantClassification, safeReasonCode: AuditOwnershipReason,
    organizationId?: string, evidenceReference?: string,
  ): AuditBackfillCandidate => ({
    auditId: row.auditId, classification, safeReasonCode,
    ...(organizationId ? { organizationId } : {}),
    ...(evidenceReference ? { evidenceReference } : {}),
  });

  if (![row.auditId, row.action, row.targetType, row.targetId].every((s) => s.trim())) {
    return candidate("invalid", "malformed_audit_row");
  }
  if (!supportedTargets.has(row.targetType)) {
    return candidate("unsupported_event_shape", "unsupported_target");
  }
  if (row.existingOrganizationId !== undefined &&
    row.existingOrganizationId !== null && !row.existingOrganizationId.trim()) {
    return candidate("invalid", "malformed_audit_row");
  }
  if (row.candidates.some((item) =>
    !item.organizationId.trim() || !item.evidenceReference.trim())) {
    return candidate("invalid", "malformed_audit_row");
  }
  const ids = new Set(row.candidates.map((item) => item.organizationId));
  if (row.existingOrganizationId) {
    if (ids.size > 1 || (ids.size === 1 && !ids.has(row.existingOrganizationId))) {
      return candidate("ambiguous", "tenant_mismatch");
    }
    return candidate("already_scoped", "already_scoped", row.existingOrganizationId);
  }
  if (ids.size > 1) return candidate("ambiguous", "conflicting_organizations");
  if (ids.size === 0) return candidate("orphaned", "target_missing");
  return candidate(
    "authoritatively_attributable", "single_authoritative_relation",
    [...ids][0], row.candidates[0]?.evidenceReference,
  );
}

/** In-memory, bounded, zero-write fixture report; not a production database scanner. */
export function auditBackfillDryRun(
  rows: readonly AuditOwnershipFixture[],
): AuditBackfillDryRunReport {
  if (rows.length > 1000) throw new RangeError("Dry-run fixture batch exceeds 1000 rows");
  const result: AuditBackfillDryRunReport = {
    examined: rows.length, alreadyScoped: 0, attributable: 0, ambiguous: 0,
    orphaned: 0, invalid: 0, unsupported: 0, manualReviewRequired: 0,
    projectedIndexes: ["AuditLog(orgId, createdAt, id)"], writesPerformed: 0,
  };
  for (const row of rows) {
    const classification = classifyAuditOwnership(row).classification;
    switch (classification) {
      case "already_scoped": result.alreadyScoped++; break;
      case "authoritatively_attributable": result.attributable++; break;
      case "ambiguous": result.ambiguous++; result.manualReviewRequired++; break;
      case "orphaned": result.orphaned++; result.manualReviewRequired++; break;
      case "invalid": result.invalid++; result.manualReviewRequired++; break;
      case "unsupported_event_shape": result.unsupported++; result.manualReviewRequired++; break;
    }
  }
  return result;
}
