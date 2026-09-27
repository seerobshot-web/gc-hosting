/**
 * Bounded, guarded historical backfill (Phase 8). Writes orgId only for
 * rows the pure classifier calls deterministic
 * ("authoritatively_attributable" — exactly one relation candidate);
 * conflicts, orphans, unsupported, invalid, and unavailable rows are left
 * untouched for separate review, never guessed at. Mirrors
 * audit-ownership-scan.ts's bounded/cursor/no-identifier-logging shape,
 * adding exactly one write per deterministic row.
 */
import {
  classifyAuditOwnership,
  type AuditOwnershipEvidence,
} from "./audit-ownership.plan";

export const AUDIT_OWNERSHIP_BACKFILL_BATCH_SIZE = 200;
export const AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS = 5_000;

export interface AuditOwnershipBackfillRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  orgId: string | null;
}

export interface AuditOwnershipBackfillReader {
  /** Every row with `orgId IS NULL`, ordered by `id ASC`, strictly after
   *  `afterId` — identical contract to the Phase 7 scan reader. */
  listNullScoped(
    afterId: string | undefined,
    limit: number,
  ): Promise<readonly AuditOwnershipBackfillRow[]>;
}

export type AuditOwnershipCandidateResolver = (
  row: AuditOwnershipBackfillRow,
) => Promise<readonly AuditOwnershipEvidence[] | "unavailable">;

/**
 * Applies the write guarded by `WHERE id = :id AND orgId IS NULL` and
 * returns whether it actually took effect. `false` means a concurrent
 * writer (a live Phase 6 write, or another backfill run) already set this
 * row's orgId between the read and this write — never an error, and never
 * grounds to overwrite whatever that concurrent writer decided.
 */
export type AuditOwnershipGuardedWriter = (
  row: AuditOwnershipBackfillRow,
  organizationId: string,
) => Promise<boolean>;

export interface AuditOwnershipBackfillSummary {
  examined: number;
  backfilled: number;
  skippedRace: number;
  alreadyScoped: number;
  conflict: number;
  orphaned: number;
  unsupported: number;
  invalid: number;
  unavailable: number;
  incomplete: boolean;
}

export async function backfillAuditOwnership(
  reader: AuditOwnershipBackfillReader,
  resolveCandidates: AuditOwnershipCandidateResolver,
  write: AuditOwnershipGuardedWriter,
): Promise<AuditOwnershipBackfillSummary> {
  let afterId: string | undefined;
  const summary: AuditOwnershipBackfillSummary = {
    examined: 0,
    backfilled: 0,
    skippedRace: 0,
    alreadyScoped: 0,
    conflict: 0,
    orphaned: 0,
    unsupported: 0,
    invalid: 0,
    unavailable: 0,
    incomplete: false,
  };

  while (summary.examined < AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS) {
    const limit = Math.min(
      AUDIT_OWNERSHIP_BACKFILL_BATCH_SIZE,
      AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS - summary.examined,
    );
    const rows = await reader.listNullScoped(afterId, limit);
    if (rows.length > limit) throw new Error("audit_ownership_backfill_invalid_batch");

    for (const row of rows) {
      if (!row.id || (afterId !== undefined && row.id <= afterId)) {
        throw new Error("audit_ownership_backfill_invalid_cursor");
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
          case "authoritatively_attributable": {
            const applied = await write(row, result.organizationId!);
            if (applied) summary.backfilled++;
            else summary.skippedRace++;
            break;
          }
          case "already_scoped": summary.alreadyScoped++; break;
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

  summary.incomplete = (await reader.listNullScoped(afterId, 1)).length > 0;
  return summary;
}
