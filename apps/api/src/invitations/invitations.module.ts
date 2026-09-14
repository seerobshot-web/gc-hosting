import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { InvitationsService } from "./invitations.service";
import {
  OrgInvitationsController,
  PublicInvitationsController,
} from "./invitations.controller";

@Module({
  imports: [AuditModule, BillingModule, AuthModule],
  providers: [InvitationsService],
  controllers: [OrgInvitationsController, PublicInvitationsController],
})
export class InvitationsModule {}
