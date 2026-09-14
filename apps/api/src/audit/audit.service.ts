import { Injectable } from "@nestjs/common";
import { prisma } from "@gch/database";

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
  async logAction(input: LogActionInput) {
    return prisma.auditLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  }

  async recent(limit = 50) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
