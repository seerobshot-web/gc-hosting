import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, Role } from "@gch/database";
import { TenancyService } from "../tenancy/tenancy.service";
import { CreateGLinkDto } from "./dto";

const WRITERS: Role[] = [Role.OWNER, Role.ADMIN];

@Injectable()
export class GlinksService {
  constructor(private readonly tenancy: TenancyService) {}

  async create(callerId: string, input: CreateGLinkDto) {
    const { client } = await this.tenancy.requireClientAccess(
      callerId,
      input.clientId,
      WRITERS,
    );
    if (client.orgId !== input.orgId) {
      throw new BadRequestException("clientId does not belong to orgId");
    }
    return prisma.gLink.create({ data: input });
  }

  async findByClient(callerId: string, clientId: string) {
    await this.tenancy.requireClientAccess(callerId, clientId);
    return prisma.gLink.findMany({
      where: { clientId, isActive: true },
      orderBy: { position: "asc" },
    });
  }

  async reorder(callerId: string, clientId: string, orderedIds: string[]) {
    await this.tenancy.requireClientAccess(callerId, clientId, WRITERS);
    // updateMany with the clientId filter means an id from another client
    // is silently a no-op rather than a cross-tenant write.
    await prisma.$transaction(
      orderedIds.map((id, position) =>
        prisma.gLink.updateMany({ where: { id, clientId }, data: { position } }),
      ),
    );
    return this.findByClient(callerId, clientId);
  }

  async deactivate(callerId: string, id: string) {
    const existing = await prisma.gLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`GLink ${id} not found`);
    await this.tenancy.requireMembership(callerId, existing.orgId, WRITERS);
    return prisma.gLink.update({ where: { id }, data: { isActive: false } });
  }
}
