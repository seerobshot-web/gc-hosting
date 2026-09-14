import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { BillingService } from "./billing.service";
import { CreateCheckoutSessionDto } from "./dto";

@ApiTags("billing")
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Catalogue — any signed-in user may see what's on offer. */
  @Get("billing/plans")
  listPlans() {
    return this.billing.listPlans();
  }

  @Get("orgs/:orgId/billing/subscription")
  @RequirePermission("billing:manage")
  getSubscription(@Tenant() tenant: TenantContext) {
    return this.billing.getSubscription(tenant.orgId);
  }

  @Get("orgs/:orgId/billing/invoices")
  @RequirePermission("billing:manage")
  listInvoices(@Tenant() tenant: TenantContext) {
    return this.billing.listInvoices(tenant.orgId);
  }

  @Post("orgs/:orgId/billing/checkout-session")
  @HttpCode(200)
  @RequirePermission("billing:manage")
  createCheckoutSession(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.billing.createCheckoutSession(tenant, dto.planId, user.email);
  }

  @Post("orgs/:orgId/billing/portal-session")
  @HttpCode(200)
  @RequirePermission("billing:manage")
  createPortalSession(@Tenant() tenant: TenantContext) {
    return this.billing.createPortalSession(tenant);
  }
}
