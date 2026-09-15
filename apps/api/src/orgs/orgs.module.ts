import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { OrgsService } from "./orgs.service";
import { OrgsController } from "./orgs.controller";
import { DomainsService } from "./domains.service";
import { DomainsController } from "./domains.controller";

@Module({
  imports: [AuditModule],
  providers: [OrgsService, DomainsService],
  controllers: [OrgsController, DomainsController],
  exports: [OrgsService, DomainsService],
})
export class OrgsModule {}
