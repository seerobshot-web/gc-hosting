import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { OrgsModule } from "./orgs/orgs.module";
import { ClientsModule } from "./clients/clients.module";
import { GlinksModule } from "./glinks/glinks.module";
import { AuditModule } from "./audit/audit.module";
import { ProvisioningModule } from "./provisioning/provisioning.module";
import { DashboardModule } from "./dashboard/dashboard.module";
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
    // Global rate limit: 60 requests/minute per IP. Auth endpoints tighten
    // this to 10/min via @Throttle (see AuthController).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 60 }]),
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
    DashboardModule,
  ],
  // Order matters: ThrottlerGuard rejects abusive traffic before auth work;
  // JwtAuthGuard then sets req.user, and RolesGuard reads it.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
