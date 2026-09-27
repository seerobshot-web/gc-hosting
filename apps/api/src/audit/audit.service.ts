import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, prisma } from "@gch/database";
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
   * Existing AuditLog rows have no authoritative orgId. Target IDs and free-form
   * metadata cannot be used for tenant isolation; refuse reads until a reviewed
   * additive migration and backfill establish trustworthy ownership.
   */
  recentForOrg(orgId: string): never {
    void orgId;
    throw new ServiceUnavailableException("Tenant-scoped audit history is unavailable");
  }
}
