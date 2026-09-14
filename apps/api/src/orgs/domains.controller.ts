import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { DomainsService } from "./domains.service";
import { AddDomainDto } from "./dto";

@ApiTags("orgs")
@ApiBearerAuth()
@Controller("orgs/:orgId/domains")
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @RequirePermission("org:manage")
  list(@Tenant() tenant: TenantContext) {
    return this.domains.list(tenant);
  }

  @Post()
  @RequirePermission("org:manage")
  add(@Tenant() tenant: TenantContext, @Body() dto: AddDomainDto) {
    return this.domains.add(tenant, dto.domain);
  }

  @Post(":id/verify")
  @HttpCode(200)
  @RequirePermission("org:manage")
  verify(@Tenant() tenant: TenantContext, @Param("id") id: string) {
    return this.domains.verify(tenant, id);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("org:manage")
  async remove(@Tenant() tenant: TenantContext, @Param("id") id: string) {
    await this.domains.remove(tenant, id);
  }
}
