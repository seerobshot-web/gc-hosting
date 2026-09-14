import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, Role } from "@gch/database";
import { can } from "@gch/permissions";
import { AuditService } from "../audit/audit.service";
import type { TenantContext } from "../rbac/tenant.decorator";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";

const memberSelect = {
  id: true,
  role: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true } },
};

/**
 * Coarse who-may-call-what lives in @RequirePermission on the controller.
 * What stays here are the rules that depend on the *target* row — OWNER
 * handling, last-owner protection, same-org scoping — which a route-level
 * permission can't express.
 */
@Injectable()
export class MembershipsService {
  constructor(private readonly audit: AuditService) {}

  async list(tenant: TenantContext) {
    const rows = await prisma.membership.findMany({
      where: { orgId: tenant.orgId },
      orderBy: { createdAt: "asc" },
      select: memberSelect,
    });
    // Field-level: plain MEMBERs see who is in the workspace, but other
    // people's email addresses are only for those who can manage them.
    if (can(tenant.membership.role, "member:manage")) return rows;
    return rows.map((m) => ({
      ...m,
      user: {
        ...m.user,
        email: m.user.id === tenant.membership.userId ? m.user.email : null,
      },
    }));
  }

  /**
   * Adds an existing portal User to the org. Inviting someone who has no
   * account yet is Stage 4's Invitation flow, not this endpoint.
   */
  async add(tenant: TenantContext, email: string, role: Role) {
    this.assertCanGrant(tenant.membership.role, role);

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException(
        "No portal account with that email — they need to register first",
      );
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: tenant.orgId } },
    });
    if (existing) {
      throw new ConflictException("That user is already a member of this org");
    }

    const membership = await prisma.membership.create({
      data: { userId: user.id, orgId: tenant.orgId, role },
      select: memberSelect,
    });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "membership.created",
      targetType: "Membership",
      targetId: membership.id,
      metadata: { orgId: tenant.orgId, userId: user.id, role },
    });
    return membership;
  }

  async changeRole(tenant: TenantContext, membershipId: string, role: Role) {
    const target = await this.findInOrg(tenant.orgId, membershipId);

    this.assertCanGrant(tenant.membership.role, role);
    this.assertCanTouch(tenant.membership.role, target.role);
    if (target.role === Role.OWNER && role !== Role.OWNER) {
      await this.assertNotLastOwner(tenant.orgId, target.id);
    }

    const updated = await prisma.membership.update({
      where: { id: target.id },
      data: { role },
      select: memberSelect,
    });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "membership.role_changed",
      targetType: "Membership",
      targetId: target.id,
      metadata: { orgId: tenant.orgId, from: target.role, to: role },
    });
    return updated;
  }

  async remove(tenant: TenantContext, membershipId: string) {
    const target = await this.findInOrg(tenant.orgId, membershipId);

    this.assertCanTouch(tenant.membership.role, target.role);
    if (target.role === Role.OWNER) {
      await this.assertNotLastOwner(tenant.orgId, target.id);
    }

    await prisma.membership.delete({ where: { id: target.id } });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "membership.removed",
      targetType: "Membership",
      targetId: target.id,
      metadata: { orgId: tenant.orgId, userId: target.userId, role: target.role },
    });
  }

  private async findInOrg(orgId: string, membershipId: string) {
    const target = await prisma.membership.findUnique({ where: { id: membershipId } });
    // Membership ids are global; scope the lookup so an ADMIN of org A
    // cannot act on a membership in org B by guessing its id.
    if (!target || target.orgId !== orgId) {
      throw new NotFoundException(`Membership ${membershipId} not found`);
    }
    return target;
  }

  /** Only an OWNER may hand out the OWNER role. */
  private assertCanGrant(callerRole: Role, granted: Role) {
    if (granted === Role.OWNER && callerRole !== Role.OWNER) {
      throw new ForbiddenException("Only an OWNER can grant the OWNER role");
    }
  }

  /** ADMINs manage MEMBERs and other ADMINs; OWNERs are only touched by OWNERs. */
  private assertCanTouch(callerRole: Role, targetRole: Role) {
    if (targetRole === Role.OWNER && callerRole !== Role.OWNER) {
      throw new ForbiddenException("Only an OWNER can change or remove an OWNER");
    }
  }

  private async assertNotLastOwner(orgId: string, excludingId: string) {
    const otherOwners = await prisma.membership.count({
      where: {
        orgId,
        role: Role.OWNER,
        status: MEMBERSHIP_ACTIVE,
        id: { not: excludingId },
      },
    });
    if (otherOwners === 0) {
      throw new BadRequestException(
        "An org must keep at least one OWNER — promote someone else first",
      );
    }
  }
}
