import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma, GLinkModuleType } from "@gch/database";

export interface CreateGLinkInput {
  orgId: string;
  clientId: string;
  moduleType: GLinkModuleType;
  label: string;
  url?: string;
  position?: number;
}

@Injectable()
export class GlinksService {
  create(input: CreateGLinkInput) {
    return prisma.gLink.create({ data: input });
  }

  findByClient(clientId: string) {
    return prisma.gLink.findMany({
      where: { clientId, isActive: true },
      orderBy: { position: "asc" },
    });
  }

  async reorder(clientId: string, orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, position) =>
        prisma.gLink.update({ where: { id }, data: { position } }),
      ),
    );
    return this.findByClient(clientId);
  }

  async deactivate(id: string) {
    const existing = await prisma.gLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`GLink ${id} not found`);
    return prisma.gLink.update({ where: { id }, data: { isActive: false } });
  }
}
