import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { GlinksService } from "./glinks.service";
import { CreateGLinkDto, ReorderGLinksDto } from "./dto";

@ApiTags("glinks")
@ApiBearerAuth()
@Controller("glinks")
export class GlinksController {
  constructor(private readonly glinksService: GlinksService) {}

  @Post()
  @RequirePermission("glink:write", "client")
  create(@Tenant() tenant: TenantContext, @Body() body: CreateGLinkDto) {
    return this.glinksService.create(tenant, body);
  }

  @Get()
  @RequirePermission("glink:read", "client")
  findByClient(@Query("clientId") clientId: string) {
    return this.glinksService.findByClient(clientId);
  }

  @Patch("reorder")
  @RequirePermission("glink:write", "client")
  reorder(@Body() body: ReorderGLinksDto) {
    return this.glinksService.reorder(body.clientId, body.orderedIds);
  }

  @Patch(":id/deactivate")
  @RequirePermission("glink:write", "glink")
  deactivate(@Param("id") id: string) {
    return this.glinksService.deactivate(id);
  }
}
