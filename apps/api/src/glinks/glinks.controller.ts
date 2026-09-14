import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { GlinksService } from "./glinks.service";
import { CreateGLinkDto, ReorderGLinksDto } from "./dto";

@ApiTags("glinks")
@Controller("glinks")
export class GlinksController {
  constructor(private readonly glinksService: GlinksService) {}

  @Post()
  create(@Body() body: CreateGLinkDto) {
    return this.glinksService.create(body);
  }

  @Get()
  findByClient(@Query("clientId") clientId: string) {
    return this.glinksService.findByClient(clientId);
  }

  @Patch("reorder")
  reorder(@Body() body: ReorderGLinksDto) {
    return this.glinksService.reorder(body.clientId, body.orderedIds);
  }

  @Patch(":id/deactivate")
  deactivate(@Param("id") id: string) {
    return this.glinksService.deactivate(id);
  }
}
