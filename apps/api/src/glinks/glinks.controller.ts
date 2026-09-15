import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  CreateGLinkDto,
  GLinkClientQueryDto,
  GLinkDto,
  GLinkIdParamsDto,
  ReorderGLinksDto,
} from "./glinks.dto";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { GlinksService } from "./glinks.service";

@ApiTags("glinks")
@ApiBearerAuth()
@Controller("glinks")
export class GlinksController {
  constructor(private readonly glinksService: GlinksService) {}

  @Post()
  @ApiCreatedResponse({ type: GLinkDto })
  @RequirePermission("glink:write", "client")
  create(@Tenant() tenant: TenantContext, @Body() body: CreateGLinkDto) {
    return this.glinksService.create(tenant, body);
  }

  @Get()
  @ApiOkResponse({ type: GLinkDto, isArray: true })
  @RequirePermission("glink:read", "client")
  findByClient(@Query("clientId") clientId: string) {
    return this.glinksService.findByClient(clientId);
  }

  @Patch("reorder")
  @ApiOkResponse({ type: GLinkDto, isArray: true })
  @RequirePermission("glink:write", "client")
  reorder(@Body() body: ReorderGLinksDto) {
    return this.glinksService.reorder(body.clientId, body.orderedIds);
  }

  @Patch(":id/deactivate")
  @ApiOkResponse({ type: GLinkDto })
  @RequirePermission("glink:write", "glink")
  deactivate(@Param() params: GLinkIdParamsDto) {
    return this.glinksService.deactivate(params.id);
  }
}
