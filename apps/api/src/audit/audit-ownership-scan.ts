/**
 * Bounded, read-only historical classification of AuditLog rows whose orgId
 * is still null (Phase 7). A capped run is explicitly incomplete; only
 * aggregate counts leave this module — no audit id, target id, action, or
 * org id is ever logged. Performs no writes: `writesPerformed` is always 0.
 *
 * Restartable means "safe to run again from scratch," not "resumes from a
 * saved cursor": there is no persisted-cursor API. Every run re-derives its
 * classification from the current `orgId IS NULL` set, which is exactly
 * what makes repeated runs safe — there is no state to get out of sync and
 * no write to ever duplicate.
 */
import {
  classifyAuditOwnership,
  type AuditOwnershipEvidence,
} from "./audit-ownership.plan";

export const AUDIT_OWNERSHIP_SCAN_BATCH_SIZE = 200;
export const AUDIT_OWNERSHIP_SCAN_MAX_ROWS = 5_000;

export interface AuditOwnershipScanRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  /** Always null for the rows this scan targets; kept so a row that turns
   *  out already-scoped (a race with Phase 6 writers) is still classified
   *  correctly rather than miscounted. */
  orgId: string | null;
}

export interface AuditOwnershipScanReader {
  /** Every row with `orgId IS NULL`, ordered by `id ASC`, strictly after
   *  `afterId` (matching the audit-integrity-scan.ts convention). */
  listNullScoped(
    afterId: string | undefined,
    limit: number,
  ): Promise<readonly AuditOwnershipScanRow[]>;
}

/**
 * Resolves this one row's relation candidates, or the literal string
 * "unavailable" on a DB error — kept distinct from an empty candidate list
 * (which means "checked, found nothing"), so a transient failure is never
 * miscounted as a real orphan.
 */
export type AuditOwnershipCandidateResolver = (
  row: AuditOwnershipScanRow,
) => Promise<readonly AuditOwnershipEvidence[] | "unavailable">;

export interface AuditOwnershipScanSummary {
  examined: number;
  alreadyScoped: number;
  resolved: number;
  conflict: number;
  orphaned: number;
  unsupported: number;
  invalid: number;
  unavailable: number;
  incomplete: boolean;
  writesPerformed: 0;
}

export async function scanAuditOwnership(
  reader: AuditOwnershipScanReader,
  resolveCandidates: AuditOwnershipCandidateResolver,
): Promise<AuditOwnershipScanSummary> {
  let afterId: string | undefined;
  const summary: AuditOwnershipScanSummary = {
    examined: 0,
    alreadyScoped: 0,
    resolved: 0,
    conflict: 0,
    orphaned: 0,
    unsupported: 0,
    invalid: 0,
    unavailable: 0,
    incomplete: false,
    writesPerformed: 0,
  };

  while (summary.examined < AUDIT_OWNERSHIP_SCAN_MAX_ROWS) {
    const limit = Math.min(
      AUDIT_OWNERSHIP_SCAN_BATCH_SIZE,
      AUDIT_OWNERSHIP_SCAN_MAX_ROWS - summary.examined,
    );
    const rows = await reader.listNullScoped(afterId, limit);
    if (rows.length > limit) throw new Error("audit_ownership_scan_invalid_batch");

    for (const row of rows) {
      // A non-advancing cursor could repeat rows or hide incomplete coverage.
      if (!row.id || (afterId !== undefined && row.id <= afterId)) {
        throw new Error("audit_ownership_scan_invalid_cursor");
      }

      const candidates = await resolveCandidates(row);
      if (candidates === "unavailable") {
        summary.unavailable++;
      } else {
        const result = classifyAuditOwnership({
          auditId: row.id,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          existingOrganizationId: row.orgId,
          candidates,
        });
        switch (result.classification) {
          case "already_scoped": summary.alreadyScoped++; break;
          case "authoritatively_attributable": summary.resolved++; break;
          case "ambiguous": summary.conflict++; break;
          case "orphaned": summary.orphaned++; break;
          case "invalid": summary.invalid++; break;
          case "unsupported_event_shape": summary.unsupported++; break;
        }
      }

      afterId = row.id;
      summary.examined++;
    }

    if (rows.length < limit) return summary;
  }

  // At most one additional read establishes whether the capped run was complete.
  summary.incomplete = (await reader.listNullScoped(afterId, 1)).length > 0;
  return summary;
}
