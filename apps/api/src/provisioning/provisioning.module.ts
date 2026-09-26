import { Module } from "@nestjs/common";
import { ProvisioningService } from "./provisioning.service";
import { PaidOrderRecoveryService } from "./paid-order-recovery.service";
import { ProvisioningController } from "./provisioning.controller";
import { ResellPortalClient } from "./resellportal.client";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [ProvisioningService, PaidOrderRecoveryService, ResellPortalClient],
  controllers: [ProvisioningController],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
