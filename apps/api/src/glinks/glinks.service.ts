import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma } from "@gch/database";
import type { TenantContext } from "../rbac/tenant.decorator";
import { CreateGLinkDto } from "./dto";

/** Org-scoped access (via the Client) is enforced by RolesGuard first. */
@Injectable()
export class GlinksService {
  create(tenant: TenantContext, input: CreateGLinkDto) {
    // The guard resolved tenant.orgId from input.clientId, so this is the
    // "does the body's orgId agree with the client's real org" check.
    if (tenant.orgId !== input.orgId) {
      throw new BadRequestException("clientId does not belong to orgId");
    }
    return prisma.gLink.create({ data: input });
  }

  findByClient(clientId: string) {
    return prisma.gLink.findMany({
      where: { clientId, isActive: true },
      orderBy: { position: "asc" },
    });
  }

  async reorder(clientId: string, orderedIds: string[]) {
    // updateMany with the clientId filter means an id from another client
    // is silently a no-op rather than a cross-tenant write.
    await prisma.$transaction(
      orderedIds.map((id, position) =>
        prisma.gLink.updateMany({ where: { id, clientId }, data: { position } }),
      ),
    );
    return this.findByClient(clientId);
  }

  deactivate(id: string) {
    return prisma.gLink.update({ where: { id }, data: { isActive: false } });
  }
}
