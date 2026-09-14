import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { OrgsService } from "./orgs.service";
import { OrgsController } from "./orgs.controller";

@Module({
  imports: [AuditModule],
  providers: [OrgsService],
  controllers: [OrgsController],
  exports: [OrgsService],
})
export class OrgsModule {}
