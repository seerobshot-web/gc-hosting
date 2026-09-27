import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { AuditOwnershipBackfillService } from "./audit-ownership-backfill.service";
import { AuditOwnershipScanService } from "./audit-ownership-scan.service";
import { AuditTenantResolverService } from "./audit-tenant-resolver.service";

/**
 * AuditOwnershipScanService (Phase 7) and AuditOwnershipBackfillService
 * (Phase 8) are registered and tested but not scheduled or exposed through
 * any route — running either against a real environment, and reviewing its
 * report, is a separate, explicitly gated operational step.
 */
@Module({
  providers: [
    AuditService,
    AuditTenantResolverService,
    AuditOwnershipScanService,
    AuditOwnershipBackfillService,
  ],
  controllers: [AuditController],
  exports: [
    AuditService,
    AuditTenantResolverService,
    AuditOwnershipScanService,
    AuditOwnershipBackfillService,
  ],
})
export class AuditModule {}
