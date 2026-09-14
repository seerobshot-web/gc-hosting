import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";
import type { JwtPayload } from "../auth/jwt.strategy";
import { RequirePermission } from "../rbac/require-permission.decorator";
import { Tenant, type TenantContext } from "../rbac/tenant.decorator";
import { InvitationsService } from "./invitations.service";
import { AcceptInvitationDto, CreateInvitationDto } from "./dto";

@ApiTags("invitations")
@ApiBearerAuth()
@Controller("orgs/:orgId/invitations")
export class OrgInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @RequirePermission("member:invite")
  list(@Tenant() tenant: TenantContext) {
    return this.invitations.list(tenant);
  }

  @Post()
  @RequirePermission("member:invite")
  create(@Tenant() tenant: TenantContext, @Body() dto: CreateInvitationDto) {
    return this.invitations.create(tenant, dto.email, dto.role);
  }

  @Post(":id/resend")
  @HttpCode(200)
  @RequirePermission("member:invite")
  resend(@Tenant() tenant: TenantContext, @Param("id") id: string) {
    return this.invitations.resend(tenant, id);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("member:invite")
  async revoke(@Tenant() tenant: TenantContext, @Param("id") id: string) {
    await this.invitations.revoke(tenant, id);
  }
}

/**
 * The one surface reachable without a session: the invite link itself is the
 * credential. A bearer token, if present and valid, lets a signed-in user
 * accept without retyping a password — but it's optional, hence @Public()
 * plus a manual verify rather than the global guard.
 */
@ApiTags("invitations")
@Controller("invitations")
export class PublicInvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Get(":token")
  preview(@Param("token") token: string) {
    return this.invitations.preview(token);
  }

  @Public()
  @Post(":token/accept")
  @HttpCode(200)
  accept(
    @Param("token") token: string,
    @Body() dto: AcceptInvitationDto,
    @Headers("authorization") authorization?: string,
  ) {
    return this.invitations.accept(token, dto, this.bearerUserId(authorization));
  }

  private bearerUserId(header?: string): string | undefined {
    const token = header?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return undefined;
    try {
      return this.jwt.verify<JwtPayload>(token).sub;
    } catch {
      return undefined;
    }
  }
}
