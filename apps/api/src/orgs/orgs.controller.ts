import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { OrgsService } from "./orgs.service";
import { CreateOrgDto, UpdateOrgDto } from "./dto";

@ApiTags("orgs")
@ApiBearerAuth()
@Controller("orgs")
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrgDto) {
    return this.orgsService.create(user.userId, dto.name);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.orgsService.findAll(user.userId);
  }

  @Get(":orgId")
  @RequirePermission("org:read")
  findOne(@Param("orgId") orgId: string) {
    return this.orgsService.findOne(orgId);
  }

  @Patch(":orgId")
  @RequirePermission("org:manage")
  update(@Tenant() tenant: TenantContext, @Body() dto: UpdateOrgDto) {
    return this.orgsService.update(tenant, dto);
  }
}
