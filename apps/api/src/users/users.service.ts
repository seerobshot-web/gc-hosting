import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";
import { MEMBERSHIP_ACTIVE } from "../tenancy/tenancy.service";
import { UpdateMeDto } from "./dto";

const meSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  lastLoginAt: true,
  memberships: {
    where: { status: MEMBERSHIP_ACTIVE },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      role: true,
      status: true,
      createdAt: true,
      org: { select: { id: true, name: true, slug: true } },
    },
  },
};

@Injectable()
export class UsersService {
  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: meSelect,
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  updateMe(userId: string, dto: UpdateMeDto) {
    return prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: meSelect,
    });
  }
}
