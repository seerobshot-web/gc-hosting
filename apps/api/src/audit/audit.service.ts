import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma, prisma } from "@gch/database";

export interface LogActionInput {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

/**
 * The single write path every module (and eventually the GCH Aleph agent)
 * goes through to record an automated or operator action. Centralizing
 * this here means the audit-integrity-check cron job only has one write
 * pattern to sanity-check for gaps.
 */
@Injectable()
export class AuditService {
  async logAction(input: LogActionInput, db: Prisma.TransactionClient = prisma) {
    return db.auditLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
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
