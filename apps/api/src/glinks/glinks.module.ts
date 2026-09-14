import { Module } from "@nestjs/common";
import { GlinksService } from "./glinks.service";
import { GlinksController } from "./glinks.controller";

@Module({
  providers: [GlinksService],
  controllers: [GlinksController],
  exports: [GlinksService],
})
export class GlinksModule {}
