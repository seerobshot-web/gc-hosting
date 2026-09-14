import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { MembershipsService } from "./memberships.service";
import { AddMemberDto, ChangeRoleDto } from "./dto";

@ApiTags("memberships")
@ApiBearerAuth()
@Controller("orgs/:orgId/memberships")
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  @RequirePermission("member:read")
  list(@Tenant() tenant: TenantContext) {
    return this.memberships.list(tenant);
  }

  @Post()
  @RequirePermission("member:invite")
  add(@Tenant() tenant: TenantContext, @Body() dto: AddMemberDto) {
    return this.memberships.add(tenant, dto.email, dto.role);
  }

  @Patch(":id")
  @RequirePermission("member:manage")
  changeRole(
    @Tenant() tenant: TenantContext,
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.memberships.changeRole(tenant, id, dto.role);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("member:manage")
  async remove(@Tenant() tenant: TenantContext, @Param("id") id: string) {
    await this.memberships.remove(tenant, id);
  }
}
