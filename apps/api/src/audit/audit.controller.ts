import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Retain the legacy path but require an explicitly scoped org membership.
   * The service denies listing until rows have an authoritative orgId.
   */
  @Get()
  @RequirePermission("org:read", "org")
  recent(@Tenant() tenant: TenantContext) {
    return this.auditService.recentForOrg(tenant.orgId);
  }
}
