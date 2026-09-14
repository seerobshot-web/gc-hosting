import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BillingModule } from "../billing/billing.module";
import { MembershipsService } from "./memberships.service";
import { MembershipsController } from "./memberships.controller";

@Module({
  imports: [AuditModule, BillingModule],
  providers: [MembershipsService],
  controllers: [MembershipsController],
  exports: [MembershipsService],
})
export class MembershipsModule {}
