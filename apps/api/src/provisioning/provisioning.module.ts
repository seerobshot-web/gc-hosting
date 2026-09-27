import { Module } from "@nestjs/common";
import { ProvisioningService } from "./provisioning.service";
import { PaidOrderRecoveryService } from "./paid-order-recovery.service";
import { ProvisioningController } from "./provisioning.controller";
import { ResellPortalClient } from "./resellportal.client";
import { OrderReadinessController } from "./order-readiness.controller";
import { OrderReadinessService } from "./order-readiness.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  providers: [ProvisioningService, PaidOrderRecoveryService, ResellPortalClient, OrderReadinessService],
  controllers: [ProvisioningController, OrderReadinessController],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
