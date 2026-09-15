import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { can } from "@gch/permissions";
import { prisma } from "@gch/database";
import { TenancyService } from "../tenancy/tenancy.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import {
  PERMISSION_KEY,
  type PermissionRequirement,
  type TenantScope,
} from "./require-permission.decorator";
import type { TenantContext } from "./tenant.decorator";

interface TenantRequest {
  user?: AuthenticatedUser;
  params: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  tenant?: TenantContext;
}

/**
 * Runs after JwtAuthGuard (APP_GUARD order). Routes without
 * @RequirePermission pass straight through; for the rest it resolves the
 * org the request is about, loads the caller's *live* Membership, checks
 * the shared permission map, and hands the result to the handler via
 * @Tenant() so services never re-derive it.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenancy: TenancyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requirement) return true;

    const req = context.switchToHttp().getRequest<TenantRequest>();
    if (!req.user) return false;

    const orgId = await this.resolveOrgId(requirement.scope, req);
    const membership = await this.tenancy.requireMembership(req.user.userId, orgId);

    if (!can(membership.role, requirement.permission)) {
      throw new ForbiddenException(
        `${requirement.permission} requires a higher role than ${membership.role}`,
      );
    }

    req.tenant = { orgId, membership };
    return true;
  }

  private async resolveOrgId(scope: TenantScope, req: TenantRequest): Promise<string> {
    switch (scope) {
      case "org": {
        const orgId = pick(req, "orgId");
        if (!orgId) throw new BadRequestException("orgId is required");
        return orgId;
      }
      case "client": {
        const clientId = pick(req, "clientId");
        if (!clientId) throw new BadRequestException("clientId is required");
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { orgId: true },
        });
        if (!client) throw new NotFoundException(`Client ${clientId} not found`);
        return client.orgId;
      }
      case "glink": {
        const id = req.params.id;
        if (!id) throw new BadRequestException("id is required");
        const glink = await prisma.gLink.findUnique({
          where: { id },
          select: { orgId: true },
        });
        if (!glink) throw new NotFoundException(`GLink ${id} not found`);
        return glink.orgId;
      }
    }
  }
}

function pick(req: TenantRequest, key: string): string | undefined {
  const candidates = [req.params[key], req.body?.[key], req.query?.[key]];
  const found = candidates.find((v) => typeof v === "string" && v.length > 0);
  return found as string | undefined;
}
