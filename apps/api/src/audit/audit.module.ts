import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { AuditTenantResolverService } from "./audit-tenant-resolver.service";

/**
 * AuditTenantResolverService is registered and tested (Phase 4) but not yet
 * called by any writer or by AuditService — that wiring is Phase 6, one
 * writer family at a time, per AUDIT-PHASE3-APPROVAL-RECORD.md.
 */
@Module({
  providers: [AuditService, AuditTenantResolverService],
  controllers: [AuditController],
  exports: [AuditService, AuditTenantResolverService],
})
export class AuditModule {}
