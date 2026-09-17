import { Module } from "@nestjs/common";
import { GlinksService } from "./glinks.service";
import { GlinksHttpClient } from "./glinks-http.client";
import { GlinksInternalGuard } from "./glinks-internal.guard";
import { GlinksController } from "./glinks.controller";

@Module({
  providers: [GlinksService, GlinksHttpClient, GlinksInternalGuard],
  controllers: [GlinksController],
  exports: [GlinksService, GlinksHttpClient, GlinksInternalGuard],
})
export class GlinksModule {}
