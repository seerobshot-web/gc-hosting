import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { AuditListQueryDto } from "./dto";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Retains the legacy path and permission. Phase 8: tenant-scoped,
   * keyset-paginated (see AuditService.recentForOrg); still fails closed
   * with 503 while AUDIT_READ_RESTORATION_ENABLED is false.
   */
  @Get()
  @RequirePermission("org:read", "org")
  recent(@Tenant() tenant: TenantContext, @Query() query: AuditListQueryDto) {
    return this.auditService.recentForOrg(tenant.orgId, query);
  }
}
