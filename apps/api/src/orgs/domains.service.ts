import { randomBytes } from "crypto";
import { promises as dns } from "dns";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import type { TenantContext } from "../rbac/tenant.decorator";

/** TXT record host prefix; keeps the apex record set untouched. */
export const VERIFY_HOST_PREFIX = "_gch-verify";
export const VERIFY_VALUE_PREFIX = "gch-verify=";

export type TxtResolver = (host: string) => Promise<string[][]>;

/**
 * DNS-TXT proof of domain ownership. This is the only path that can make
 * Org.autoJoinDomain legal: OrgsService.update refuses any domain without a
 * verifiedAt stamp here. Public email providers are refused outright — a
 * verified gmail.com would auto-join the whole world.
 */
@Injectable()
export class DomainsService {
  /** Swappable so tests can stand in for real DNS. */
  resolveTxt: TxtResolver = (host) => dns.resolveTxt(host);

  constructor(private readonly audit: AuditService) {}

  list(tenant: TenantContext) {
    return prisma.orgDomainVerification.findMany({
      where: { orgId: tenant.orgId },
      orderBy: { createdAt: "asc" },
    });
  }

  async add(tenant: TenantContext, rawDomain: string) {
    const domain = normalize(rawDomain);
    if (PUBLIC_MAIL_DOMAINS.has(domain)) {
      throw new BadRequestException("Public email providers cannot be verified for auto-join");
    }
    const existing = await prisma.orgDomainVerification.findUnique({
      where: { orgId_domain: { orgId: tenant.orgId, domain } },
    });
    if (existing) throw new ConflictException("That domain is already registered for this org");

    const record = await prisma.orgDomainVerification.create({
      data: { orgId: tenant.orgId, domain, dnsTxtToken: randomBytes(16).toString("hex") },
    });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "domain.added",
      targetType: "OrgDomainVerification",
      targetId: record.id,
      metadata: { orgId: tenant.orgId, domain },
    });
    return withInstructions(record);
  }

  async verify(tenant: TenantContext, id: string) {
    const record = await this.findInOrg(tenant.orgId, id);
    if (record.verifiedAt) return withInstructions(record);

    const expected = `${VERIFY_VALUE_PREFIX}${record.dnsTxtToken}`;
    let found: string[] = [];
    try {
      const answers = await this.resolveTxt(`${VERIFY_HOST_PREFIX}.${record.domain}`);
      // A TXT answer is an array of string chunks that must be re-joined.
      found = answers.map((chunks) => chunks.join(""));
    } catch {
      /* NXDOMAIN / ENODATA / timeout all mean "not there (yet)" */
    }

    if (!found.includes(expected)) {
      throw new BadRequestException(
        `TXT record not found. Publish ${VERIFY_HOST_PREFIX}.${record.domain} = "${expected}" and try again (DNS changes can take a while to propagate).`,
      );
    }

    const verified = await prisma.orgDomainVerification.update({
      where: { id },
      data: { verifiedAt: new Date() },
    });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "domain.verified",
      targetType: "OrgDomainVerification",
      targetId: id,
      metadata: { orgId: tenant.orgId, domain: record.domain },
    });
    return withInstructions(verified);
  }

  async remove(tenant: TenantContext, id: string) {
    const record = await this.findInOrg(tenant.orgId, id);
    await prisma.$transaction(async (tx) => {
      // Removing the proof must also switch off anything relying on it.
      await tx.org.updateMany({
        where: { id: tenant.orgId, autoJoinDomain: record.domain },
        data: { autoJoinDomain: null },
      });
      await tx.orgDomainVerification.delete({ where: { id } });
    });
    await this.audit.logAction({
      actor: `user:${tenant.membership.userId}`,
      action: "domain.removed",
      targetType: "OrgDomainVerification",
      targetId: id,
      metadata: { orgId: tenant.orgId, domain: record.domain },
    });
  }

  async isVerified(orgId: string, domain: string) {
    const record = await prisma.orgDomainVerification.findUnique({
      where: { orgId_domain: { orgId, domain: normalize(domain) } },
    });
    return Boolean(record?.verifiedAt);
  }

  private async findInOrg(orgId: string, id: string) {
    const record = await prisma.orgDomainVerification.findUnique({ where: { id } });
    if (!record || record.orgId !== orgId) {
      throw new NotFoundException(`Domain verification ${id} not found`);
    }
    return record;
  }
}

export function normalize(domain: string) {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

function withInstructions<T extends { domain: string; dnsTxtToken: string }>(record: T) {
  return {
    ...record,
    dns: {
      type: "TXT",
      host: `${VERIFY_HOST_PREFIX}.${record.domain}`,
      value: `${VERIFY_VALUE_PREFIX}${record.dnsTxtToken}`,
    },
  };
}

const PUBLIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "gmx.com",
  "zoho.com",
  "yandex.com",
]);
