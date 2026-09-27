import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@gch/database";
import { RELATION_LOOKUP_BY_TARGET_TYPE } from "./audit-ownership-relations";
import {
  backfillAuditOwnership,
  type AuditOwnershipBackfillReader,
  type AuditOwnershipBackfillRow,
  type AuditOwnershipBackfillSummary,
} from "./audit-ownership-backfill";

/**
 * Real-Prisma wiring for the Phase 8 controlled backfill. Not scheduled or
 * exposed through any route — running it against a real environment is a
 * separate, explicitly approved operational step, only after that
 * environment's Phase 7 dry-run report has been reviewed.
 */
@Injectable()
export class AuditOwnershipBackfillService {
  private readonly logger = new Logger(AuditOwnershipBackfillService.name);

  private readonly reader: AuditOwnershipBackfillReader = {
    listNullScoped: (afterId, limit) =>
      prisma.auditLog.findMany({
        where: {
          orgId: null,
          ...(afterId === undefined ? {} : { id: { gt: afterId } }),
        },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true, action: true, targetType: true, targetId: true, orgId: true },
      }),
  };

  async run(): Promise<AuditOwnershipBackfillSummary> {
    const summary = await backfillAuditOwnership(
      this.reader,
      (row) => this.resolveCandidates(row),
      (row, organizationId) => this.guardedWrite(row, organizationId),
    );
    this.logger.log(
      `[audit-ownership-backfill] examined=${summary.examined} backfilled=${summary.backfilled} ` +
        `skippedRace=${summary.skippedRace} conflict=${summary.conflict} orphaned=${summary.orphaned} ` +
        `unsupported=${summary.unsupported} invalid=${summary.invalid} unavailable=${summary.unavailable} ` +
        `alreadyScoped=${summary.alreadyScoped} incomplete=${summary.incomplete}`,
    );
    return summary;
  }

  private async resolveCandidates(row: AuditOwnershipBackfillRow) {
    const lookup = RELATION_LOOKUP_BY_TARGET_TYPE[row.targetType];
    if (!lookup) return [];
    try {
      const result = await lookup(row.targetId);
      if (!result.found || result.relationUnavailable || !result.organizationId || !result.relation) {
        return [];
      }
      return [
        {
          organizationId: result.organizationId,
          relation: result.relation,
          evidenceReference: row.targetId,
        },
      ];
    } catch (err) {
      this.logger.error(
        `audit ownership backfill relation lookup failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return "unavailable" as const;
    }
  }

  /**
   * `updateMany` (not `update`) so the `orgId: null` guard is enforced
   * atomically at the DB level — a compound WHERE a plain unique-key
   * `update` cannot express. `count === 0` means a concurrent writer (a
   * live Phase 6 write, or a previous/overlapping backfill run) already
   * set this row; we never overwrite that.
   */
  private async guardedWrite(row: AuditOwnershipBackfillRow, organizationId: string): Promise<boolean> {
    const result = await prisma.auditLog.updateMany({
      where: { id: row.id, orgId: null },
      data: { orgId: organizationId },
    });
    return result.count === 1;
  }
}
