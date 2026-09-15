import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Membership } from "@gch/database";

/** What RolesGuard resolved for this request; only set on
 *  @RequirePermission routes. */
export interface TenantContext {
  orgId: string;
  membership: Membership;
}

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    return ctx.switchToHttp().getRequest().tenant;
  },
);
