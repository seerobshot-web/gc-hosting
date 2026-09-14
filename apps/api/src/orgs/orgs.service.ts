import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { prisma, Role } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import { MEMBERSHIP_ACTIVE, TenancyService } from "../tenancy/tenancy.service";

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
    private readonly tenancy: TenancyService,
    private readonly audit: AuditService,
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

  async findOne(callerId: string, id: string) {
    await this.tenancy.requireMembership(callerId, id);
    return prisma.org.findUniqueOrThrow({ where: { id } });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const taken = await prisma.org.findUnique({ where: { slug: base } });
    if (!taken) return base;
    return `${base}-${randomBytes(3).toString("hex")}`;
  }
}
