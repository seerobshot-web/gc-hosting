import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { OrderReadinessService } from "./order-readiness.service";

@ApiTags("provisioning")
@ApiBearerAuth()
@Controller("orgs/:orgId/orders")
export class OrderReadinessController {
  constructor(private readonly readiness: OrderReadinessService) {}

  @Get(":orderId/readiness")
  @RequirePermission("provisioning:read", "org")
  findForOrg(@Param("orderId") orderId: string, @Tenant() tenant: TenantContext) {
    return this.readiness.findForOrg(orderId, tenant.orgId);
  }
}
