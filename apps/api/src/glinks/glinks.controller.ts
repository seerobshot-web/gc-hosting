import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { GlinksService, CreateGLinkInput } from "./glinks.service";

@ApiTags("glinks")
@Controller("glinks")
export class GlinksController {
  constructor(private readonly glinksService: GlinksService) {}

  @Post()
  create(@Body() body: CreateGLinkInput) {
    return this.glinksService.create(body);
  }

  @Get()
  findByClient(@Query("clientId") clientId: string) {
    return this.glinksService.findByClient(clientId);
  }

  @Patch("reorder")
  reorder(@Body() body: { clientId: string; orderedIds: string[] }) {
    return this.glinksService.reorder(body.clientId, body.orderedIds);
  }

  @Patch(":id/deactivate")
  deactivate(@Param("id") id: string) {
    return this.glinksService.deactivate(id);
  }
}
