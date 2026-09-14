import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, Role } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import { MEMBERSHIP_ACTIVE, TenancyService } from "../tenancy/tenancy.service";

const MANAGERS: Role[] = [Role.OWNER, Role.ADMIN];

const memberSelect = {
  id: true,
  role: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true } },
};

@Injectable()
export class MembershipsService {
  constructor(
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
  ) {}

  async list(callerId: string, orgId: string) {
    await this.tenancy.requireMembership(callerId, orgId);
    return prisma.membership.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: memberSelect,
    });
  }

  /**
   * Adds an existing portal User to the org. Inviting someone who has no
   * account yet is Stage 4's Invitation flow, not this endpoint.
   */
  async add(callerId: string, orgId: string, email: string, role: Role) {
    const caller = await this.tenancy.requireMembership(callerId, orgId, MANAGERS);
    this.assertCanGrant(caller.role, role);

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException(
        "No portal account with that email — they need to register first",
      );
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });
    if (existing) {
      throw new ConflictException("That user is already a member of this org");
    }

    const membership = await prisma.membership.create({
      data: { userId: user.id, orgId, role },
      select: memberSelect,
    });
    await this.audit.logAction({
      actor: `user:${callerId}`,
      action: "membership.created",
      targetType: "Membership",
      targetId: membership.id,
      metadata: { orgId, userId: user.id, role },
    });
    return membership;
  }

  async changeRole(callerId: string, orgId: string, membershipId: string, role: Role) {
    const caller = await this.tenancy.requireMembership(callerId, orgId, MANAGERS);
    const target = await this.findInOrg(orgId, membershipId);

    this.assertCanGrant(caller.role, role);
    this.assertCanTouch(caller.role, target.role);
    if (target.role === Role.OWNER && role !== Role.OWNER) {
      await this.assertNotLastOwner(orgId, target.id);
    }

    const updated = await prisma.membership.update({
      where: { id: target.id },
      data: { role },
      select: memberSelect,
    });
    await this.audit.logAction({
      actor: `user:${callerId}`,
      action: "membership.role_changed",
      targetType: "Membership",
      targetId: target.id,
      metadata: { orgId, from: target.role, to: role },
    });
    return updated;
  }

  async remove(callerId: string, orgId: string, membershipId: string) {
    const caller = await this.tenancy.requireMembership(callerId, orgId, MANAGERS);
    const target = await this.findInOrg(orgId, membershipId);

    this.assertCanTouch(caller.role, target.role);
    if (target.role === Role.OWNER) {
      await this.assertNotLastOwner(orgId, target.id);
    }

    await prisma.membership.delete({ where: { id: target.id } });
    await this.audit.logAction({
      actor: `user:${callerId}`,
      action: "membership.removed",
      targetType: "Membership",
      targetId: target.id,
      metadata: { orgId, userId: target.userId, role: target.role },
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
