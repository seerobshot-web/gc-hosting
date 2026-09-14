import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";

@Injectable()
export class OrgsService {
  create(name: string) {
    return prisma.org.create({ data: { name } });
  }

  findAll() {
    return prisma.org.findMany();
  }

  async findOne(id: string) {
    const org = await prisma.org.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Org ${id} not found`);
    return org;
  }
}
