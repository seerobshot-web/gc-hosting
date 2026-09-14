import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";
import { TenancyService } from "../tenancy/tenancy.service";
import { CreateClientDto } from "./dto";

/**
 * Mirrors the FOSSBilling client record via fossbillingClientId — this
 * service never writes or reads billing amounts/invoices itself. FOSSBilling
 * stays the system of record for money; this is the identity join.
 *
 * Org-scoped access is enforced by RolesGuard before these run.
 */
@Injectable()
export class ClientsService {
  constructor(private readonly tenancy: TenancyService) {}

  create(input: CreateClientDto) {
    return prisma.client.create({ data: input });
  }

  /** Scoped to one org when given, otherwise to every org the caller is in. */
  async findAll(callerId: string, orgId?: string) {
    if (orgId) {
      await this.tenancy.requireMembership(callerId, orgId);
      return prisma.client.findMany({ where: { orgId } });
    }
    const orgIds = await this.tenancy.memberOrgIds(callerId);
    return prisma.client.findMany({ where: { orgId: { in: orgIds } } });
  }

  async findOne(id: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  findByFossbillingId(fossbillingClientId: string) {
    return prisma.client.findUnique({ where: { fossbillingClientId } });
  }
}
