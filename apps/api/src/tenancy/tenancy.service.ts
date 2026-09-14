import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma, Role } from "@gch/database";

export const MEMBERSHIP_ACTIVE = "ACTIVE";

/**
 * The one place tenant isolation is decided. Every route that takes an
 * orgId/clientId from the caller resolves it through here so the answer to
 * "may this user touch this org" is a live Membership lookup, never a claim
 * carried in the JWT — role changes and removals take effect immediately.
 */
@Injectable()
export class TenancyService {
  /** 404 (not 403) when the caller has no active membership: a non-member
   *  must not be able to learn that an org exists. */
  async requireMembership(userId: string, orgId: string, roles?: Role[]) {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
      throw new NotFoundException(`Org ${orgId} not found`);
    }
    if (roles && !roles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of: ${roles.join(", ")} (you are ${membership.role})`,
      );
    }
    return membership;
  }

  /** Resolves a Client to its Org and enforces membership in that Org. */
  async requireClientAccess(userId: string, clientId: string, roles?: Role[]) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);
    const membership = await this.requireMembership(userId, client.orgId, roles);
    return { client, membership };
  }

  memberOrgIds(userId: string) {
    return prisma.membership
      .findMany({
        where: { userId, status: MEMBERSHIP_ACTIVE },
        select: { orgId: true },
      })
      .then((rows) => rows.map((r) => r.orgId));
  }
}
