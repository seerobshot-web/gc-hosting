import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, prisma } from "@gch/database";
import { AUDIT_LIST_DEFAULT_LIMIT, AUDIT_LIST_MAX_LIMIT } from "./dto";
import { AUDIT_READ_RESTORATION_ENABLED } from "./audit-read-rollout";
import { decodeAuditReadCursor, encodeAuditReadCursor } from "./audit-read-cursor";
import { AUDIT_TENANT_RESOLUTION_ENABLED_ACTIONS } from "./audit-tenant-resolution.rollout";
import { AuditTenantResolverService } from "./audit-tenant-resolver.service";
import { mintServerBoundAuditTarget, type VerifiedAuditPrincipal } from "./audit-tenant-resolver.types";

export interface LogActionInput {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  /**
   * Phase 6: when provided for an action listed in
   * audit-tenant-resolution.rollout.ts, resolves and attaches orgId via
   * AuditTenantResolverService. Omitting it (or an action not yet in that
   * allowlist) preserves the exact pre-Phase-6 write: orgId stays null.
   * A resolution failure of any kind never blocks or fails this write —
   * the audit event is best-effort attribution, never a gate on the
   * caller's actual business operation.
   */
  principal?: VerifiedAuditPrincipal;
}

/**
 * The single write path every module (and eventually the GCH Aleph agent)
 * goes through to record an automated or operator action. Centralizing
 * this here means the audit-integrity-check cron job only has one write
 * pattern to sanity-check for gaps.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly resolver: AuditTenantResolverService) {}

  async logAction(input: LogActionInput, db: Prisma.TransactionClient = prisma) {
    const orgId = await this.resolveOrgId(input);
    return db.auditLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        orgId,
      },
    });
  }

  private async resolveOrgId(input: LogActionInput): Promise<string | null> {
    if (!input.principal) return null;
    if (!AUDIT_TENANT_RESOLUTION_ENABLED_ACTIONS.has(input.action)) return null;

    try {
      const resolution = await this.resolver.resolve({
        action: input.action,
        target: mintServerBoundAuditTarget(input.targetType, input.targetId),
        principal: input.principal,
      });
      if (resolution.kind === "resolved") return resolution.organizationId;
      // Not silent: every non-resolved outcome is visible in operational
      // logs, even though the write itself always proceeds with orgId
      // null — never overwrite a trusted key with a guess.
      this.logger.warn(
        `Audit tenant resolution did not assign an org for ${input.action} -> ` +
          `${input.targetType}:${input.targetId} (${resolution.kind})`,
      );
      return null;
    } catch (err) {
      this.logger.error(
        `Audit tenant resolution threw for ${input.action} -> ${input.targetType}:${input.targetId}: ` +
          `${err instanceof Error ? err.message : "unknown"}`,
      );
      return null;
    }
  }

  /**
   * Phase 8: tenant-scoped, keyset-paginated read, gated by
   * AUDIT_READ_RESTORATION_ENABLED (see audit-read-rollout.ts for the
   * rollback lever). `orgId` comes only from the caller's guard-verified
   * TenantContext — never from a request body/query — so a row belonging
   * to another org can never be selected, and a null-orgId row (not yet
   * resolved or backfilled) is simply excluded, never surfaced as
   * belonging to the wrong org.
   */
  async recentForOrg(
    orgId: string,
    query: { cursor?: string; limit?: number } = {},
  ): Promise<AuditListPage> {
    if (!AUDIT_READ_RESTORATION_ENABLED) {
      throw new ServiceUnavailableException("Tenant-scoped audit history is unavailable");
    }

    const limit = Math.min(
      Math.max(query.limit ?? AUDIT_LIST_DEFAULT_LIMIT, 1),
      AUDIT_LIST_MAX_LIMIT,
    );

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor !== undefined) {
      const decoded = decodeAuditReadCursor(query.cursor);
      if (!decoded) throw new BadRequestException("Invalid cursor");
      cursor = decoded;
    }

    const rows = await prisma.auditLog.findMany({
      where: {
        orgId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        actor: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeAuditReadCursor({ createdAt: last.createdAt, id: last.id }) : null;

    return {
      items: page.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
        createdAt: row.createdAt,
      })),
      nextCursor,
    };
  }
}

export interface AuditListItem {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditListPage {
  items: AuditListItem[];
  nextCursor: string | null;
}
