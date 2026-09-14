import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { prisma, Role } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import type { TenantContext } from "../rbac/tenant.decorator";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";
import { DomainsService, normalize } from "./domains.service";
import { UpdateOrgDto } from "./dto";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "org";
}

@Injectable()
export class OrgsService {
  constructor(
    private readonly audit: AuditService,
    private readonly domains: DomainsService,
  ) {}

  /** Creating an org makes the caller its first OWNER, atomically. */
  async create(callerId: string, name: string) {
    const slug = await this.uniqueSlug(name);
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.org.create({ data: { name, slug } });
      await tx.membership.create({
        data: { orgId: created.id, userId: callerId, role: Role.OWNER },
      });
      return created;
    });
    await this.audit.logAction({
      actor: `user:${callerId}`,
      action: "org.created",
      targetType: "Org",
      targetId: org.id,
      metadata: { slug },
    });
    return org;
  }

  findAll(callerId: string) {
    return prisma.org.findMany({
      where: {
        memberships: { some: { userId: callerId, status: MEMBERSHIP_ACTIVE } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Membership already enforced by RolesGuard (@RequirePermission). */
  findOne(id: string) {
    return prisma.org.findUniqueOrThrow({ where: { id } });
  }

  async update(tenant: TenantContext, dto: UpdateOrgDto) {
    const data: { name?: string; autoJoinDomain?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name;

    if (dto.autoJoinDomain !== undefined) {
      if (dto.autoJoinDomain === null) {
        data.autoJoinDomain = null;
      } else {
        const domain = normalize(dto.autoJoinDomain);
        // The gate: auto-join is never a bare toggle, only ever a verified domain.
        if (!(await this.domains.isVerified(tenant.orgId, domain))) {
          throw new BadRequestException(
            `${domain} is not verified for this org — add it under domains and publish the TXT record first`,
          );
        }
        const claimedBy = await prisma.org.findUnique({ where: { autoJoinDomain: domain } });
        if (claimedBy && claimedBy.id !== tenant.orgId) {
          throw new ConflictException(`${domain} is already used for auto-join by another org`);
        }
        data.autoJoinDomain = domain;
      }
    }

    const before = await prisma.org.findUniqueOrThrow({ where: { id: tenant.orgId } });
    const org = await prisma.org.update({ where: { id: tenant.orgId }, data });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "org.updated",
      targetType: "Org",
      targetId: org.id,
      metadata: {
        ...(data.name !== undefined ? { name: { from: before.name, to: org.name } } : {}),
        ...(data.autoJoinDomain !== undefined
          ? { autoJoinDomain: { from: before.autoJoinDomain, to: org.autoJoinDomain } }
          : {}),
      },
    });
    return org;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const taken = await prisma.org.findUnique({ where: { slug: base } });
    if (!taken) return base;
    return `${base}-${randomBytes(3).toString("hex")}`;
  }
}
