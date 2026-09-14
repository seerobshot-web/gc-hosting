import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { OrgsModule } from "./orgs/orgs.module";
import { ClientsModule } from "./clients/clients.module";
import { GlinksModule } from "./glinks/glinks.module";
import { AuditModule } from "./audit/audit.module";
import { ProvisioningModule } from "./provisioning/provisioning.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    OrgsModule,
    ClientsModule,
    GlinksModule,
    AuditModule,
    ProvisioningModule,
  ],
})
export class AppModule {}
