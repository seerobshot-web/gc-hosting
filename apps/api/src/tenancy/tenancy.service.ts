import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";

export const MEMBERSHIP_ACTIVE = "ACTIVE";

/**
 * The one place tenant isolation is decided. RolesGuard resolves the org a
 * request is about and calls requireMembership so the answer to "may this
 * user touch this org" is always a live lookup, never a claim carried in
 * the JWT — role changes and removals take effect immediately.
 */
@Injectable()
export class TenancyService {
  /** 404 (not 403) when the caller has no active membership: a non-member
   *  must not be able to learn that an org exists. */
  async requireMembership(userId: string, orgId: string) {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership || membership.status !== MEMBERSHIP_ACTIVE) {
      throw new NotFoundException(`Org ${orgId} not found`);
    }
    return membership;
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
