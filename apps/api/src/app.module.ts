import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { OrgsModule } from "./orgs/orgs.module";
import { ClientsModule } from "./clients/clients.module";
import { GlinksModule } from "./glinks/glinks.module";
import { AuditModule } from "./audit/audit.module";
import { ProvisioningModule } from "./provisioning/provisioning.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { TenancyModule } from "./tenancy/tenancy.module";
import { RolesGuard } from "./rbac/roles.guard";
import { UsersModule } from "./users/users.module";
import { MembershipsModule } from "./memberships/memberships.module";
import { BillingModule } from "./billing/billing.module";
import { EmailModule } from "./email/email.module";
import { InvitationsModule } from "./invitations/invitations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TenancyModule,
    EmailModule,
    AuthModule,
    InvitationsModule,
    UsersModule,
    MembershipsModule,
    BillingModule,
    OrgsModule,
    ClientsModule,
    GlinksModule,
    AuditModule,
    ProvisioningModule,
  ],
  // Order matters: JwtAuthGuard sets req.user, RolesGuard reads it.
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
