import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";
import { CreateGLinkDto } from "./glinks.dto";

@Injectable()
export class GlinksService {
  create(input: CreateGLinkDto) {
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
      orderedIds.map((id, position) => prisma.gLink.update({ where: { id }, data: { position } })),
    );
    return this.findByClient(clientId);
  }

  async deactivate(id: string) {
    const existing = await prisma.gLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`GLink ${id} not found`);
    return prisma.gLink.update({ where: { id }, data: { isActive: false } });
  }
}
