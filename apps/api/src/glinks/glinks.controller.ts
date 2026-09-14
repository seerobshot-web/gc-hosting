import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  CreateGLinkDto,
  GLinkClientQueryDto,
  GLinkDto,
  GLinkIdParamsDto,
  ReorderGLinksDto,
} from "./glinks.dto";
import { GlinksService } from "./glinks.service";

@ApiTags("glinks")
@Controller("glinks")
export class GlinksController {
  constructor(private readonly glinksService: GlinksService) {}

  @Post()
  @ApiCreatedResponse({ type: GLinkDto })
  create(@Body() body: CreateGLinkDto) {
    return this.glinksService.create(body);
  }

  @Get()
  @ApiOkResponse({ type: GLinkDto, isArray: true })
  findByClient(@Query() query: GLinkClientQueryDto) {
    return this.glinksService.findByClient(query.clientId);
  }

  @Patch("reorder")
  @ApiOkResponse({ type: GLinkDto, isArray: true })
  reorder(@Body() body: ReorderGLinksDto) {
    return this.glinksService.reorder(body.clientId, body.orderedIds);
  }

  @Patch(":id/deactivate")
  @ApiOkResponse({ type: GLinkDto })
  deactivate(@Param() params: GLinkIdParamsDto) {
    return this.glinksService.deactivate(params.id);
  }
}
