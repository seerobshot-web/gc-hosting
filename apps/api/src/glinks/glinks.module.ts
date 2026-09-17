import { Module } from "@nestjs/common";
import { GlinksService } from "./glinks.service";
import { GlinksHttpClient } from "./glinks-http.client";
import { GlinksController } from "./glinks.controller";

@Module({
  providers: [GlinksService, GlinksHttpClient],
  controllers: [GlinksController],
  exports: [GlinksService, GlinksHttpClient],
})
export class GlinksModule {}
