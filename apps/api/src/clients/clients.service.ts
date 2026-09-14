import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";

export interface CreateClientInput {
  orgId: string;
  fossbillingClientId: string;
  email: string;
}

/**
 * Mirrors the FOSSBilling client record via fossbillingClientId — this
 * service never writes or reads billing amounts/invoices itself. FOSSBilling
 * stays the system of record for money; this is the identity join.
 */
@Injectable()
export class ClientsService {
  create(input: CreateClientInput) {
    return prisma.client.create({ data: input });
  }

  findAll(orgId?: string) {
    return prisma.client.findMany({ where: orgId ? { orgId } : undefined });
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
