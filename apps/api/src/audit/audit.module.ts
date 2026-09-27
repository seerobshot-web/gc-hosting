import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { AuditOwnershipScanService } from "./audit-ownership-scan.service";
import { AuditTenantResolverService } from "./audit-tenant-resolver.service";

/**
 * AuditOwnershipScanService (Phase 7) is registered and tested but not
 * scheduled or exposed through any route — invoking it and reviewing its
 * report is a separate, explicitly gated step before any Phase 8 backfill.
 */
@Module({
  providers: [AuditService, AuditTenantResolverService, AuditOwnershipScanService],
  controllers: [AuditController],
  exports: [AuditService, AuditTenantResolverService, AuditOwnershipScanService],
})
export class AuditModule {}
