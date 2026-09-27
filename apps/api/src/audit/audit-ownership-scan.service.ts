import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@gch/database";
import { RELATION_LOOKUP_BY_TARGET_TYPE } from "./audit-ownership-relations";
import {
  scanAuditOwnership,
  type AuditOwnershipScanReader,
  type AuditOwnershipScanRow,
  type AuditOwnershipScanSummary,
} from "./audit-ownership-scan";

/**
 * Real-Prisma wiring for the Phase 7 dry-run scanner. Not scheduled or
 * exposed through any route in this phase — invoking it (from an operator
 * script or a future approved admin action) and reviewing its report is a
 * separate, explicitly gated step before any Phase 8 backfill.
 */
@Injectable()
export class AuditOwnershipScanService {
  private readonly logger = new Logger(AuditOwnershipScanService.name);

  private readonly reader: AuditOwnershipScanReader = {
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

  async runDryRun(): Promise<AuditOwnershipScanSummary> {
    const summary = await scanAuditOwnership(this.reader, (row) => this.resolveCandidates(row));
    this.logger.log(
      `[audit-ownership-scan] examined=${summary.examined} resolved=${summary.resolved} ` +
        `conflict=${summary.conflict} orphaned=${summary.orphaned} unsupported=${summary.unsupported} ` +
        `invalid=${summary.invalid} unavailable=${summary.unavailable} ` +
        `alreadyScoped=${summary.alreadyScoped} incomplete=${summary.incomplete} ` +
        `writesPerformed=${summary.writesPerformed}`,
    );
    return summary;
  }

  private async resolveCandidates(row: AuditOwnershipScanRow) {
    const lookup = RELATION_LOOKUP_BY_TARGET_TYPE[row.targetType];
    if (!lookup) return []; // classifyAuditOwnership itself yields unsupported_event_shape
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
        `audit ownership scan relation lookup failed: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return "unavailable" as const;
    }
  }
}
