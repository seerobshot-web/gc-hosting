import { Injectable } from "@nestjs/common";
import { prisma } from "@gch/database";

interface GetOverviewInput {
  orgId?: string;
}

@Injectable()
export class DashboardService {
  async getOverview(input: GetOverviewInput) {
    const orgFilter = input.orgId ? { orgId: input.orgId } : undefined;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const clientWhere = orgFilter ? { orgId: input.orgId } : undefined;
    const orderWhere = orgFilter
      ? { client: { orgId: input.orgId } }
      : undefined;

    const [
      totalClients,
      newRegistrationsLast7Days,
      totalOrders,
      provisioningOrders,
      deployedOrders,
      failedOrders,
      recentRegistrations,
      rootTracking,
    ] = await Promise.all([
      prisma.client.count({ where: clientWhere }),
      prisma.client.count({
        where: { ...(clientWhere ?? {}), createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.provisioningOrder.count({ where: orderWhere }),
      prisma.provisioningOrder.count({
        where: { ...(orderWhere ?? {}), status: "provisioning" },
      }),
      prisma.provisioningOrder.count({
        where: { ...(orderWhere ?? {}), status: "deployed" },
      }),
      prisma.provisioningOrder.count({
        where: { ...(orderWhere ?? {}), status: "failed" },
      }),
      prisma.client.findMany({
        where: clientWhere,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      }),
      prisma.provisioningOrder.findMany({
        where: orderWhere,
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          primaryDomain: true,
          cpanelUsername: true,
          status: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      infrastructure: {
        totalOrders,
        provisioningOrders,
        deployedOrders,
        failedOrders,
      },
      registrations: {
        totalClients,
        newLast7Days: newRegistrationsLast7Days,
        recent: recentRegistrations,
      },
      rootTracking: rootTracking.map((order) => ({
        ...order,
        host: "Hostinger",
      })),
    };
  }
}
