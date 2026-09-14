import { Injectable } from "@nestjs/common";
import { prisma } from "@gch/database";

interface RouteHealth {
  method: "GET" | "POST" | "PATCH";
  path: string;
  status: "healthy" | "degraded" | "not_probed";
  detail: string;
}

@Injectable()
export class DashboardService {
  private getApiRouteHealth(input: {
    clientsReadable: boolean;
    provisioningReadable: boolean;
  }): RouteHealth[] {
    const clientsStatus = input.clientsReadable
      ? { status: "healthy" as const, detail: "read query completed" }
      : { status: "degraded" as const, detail: "read query failed" };
    const provisioningStatus = input.provisioningReadable
      ? { status: "healthy" as const, detail: "read query completed" }
      : { status: "degraded" as const, detail: "read query failed" };
    const notProbed = {
      status: "not_probed" as const,
      detail: "write route or unexercised read route",
    };
    return [
      { method: "GET", path: "/orgs", ...notProbed },
      { method: "POST", path: "/orgs", ...notProbed },
      { method: "GET", path: "/orgs/:id", ...notProbed },
      { method: "GET", path: "/clients", ...clientsStatus },
      { method: "POST", path: "/clients", ...notProbed },
      { method: "GET", path: "/clients/:id", ...notProbed },
      { method: "GET", path: "/glinks", ...notProbed },
      { method: "POST", path: "/glinks", ...notProbed },
      { method: "PATCH", path: "/glinks/reorder", ...notProbed },
      { method: "PATCH", path: "/glinks/:id/deactivate", ...notProbed },
      {
        method: "GET",
        path: "/provisioning/orders/:clientId",
        ...provisioningStatus,
      },
      { method: "POST", path: "/provisioning/orders", ...notProbed },
      { method: "GET", path: "/audit", ...notProbed },
      {
        method: "GET",
        path: "/dashboard/overview",
        status: "healthy",
        detail: "response assembled",
      },
      {
        method: "GET",
        path: "/docs",
        status: "not_probed",
        detail: "swagger route registration not probed here",
      },
    ];
  }

  async getOverview() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const clientWhere = undefined;
    const orderWhere = undefined;

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
    const apiRouteHealth = this.getApiRouteHealth({
      clientsReadable: true,
      provisioningReadable: true,
    });

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
      rootTracking: rootTracking.map((order: (typeof rootTracking)[number]) => ({
        id: order.id,
        primaryDomain: order.primaryDomain,
        cpanelUsername: order.cpanelUsername,
        status: order.status,
        updatedAt: order.updatedAt,
        createdAt: order.createdAt,
        host: "Hostinger",
      })),
      apiRouteHealth,
      pageDestinations: [
        {
          path: "/",
          purpose: "Primary portal entry and cross-link hub",
          backlinkFocus: "Link to /dashboard and /dashboard/glinks from partner docs",
          structuredContentType: "WebSite",
          metadataFocus: "Brand + hosting operations summary keywords",
        },
        {
          path: "/dashboard",
          purpose: "Infrastructure, sign-up, and root-tracking operations view",
          backlinkFocus: "Reference from onboarding and provisioning docs",
          structuredContentType: "Dataset",
          metadataFocus: "Hostinger infrastructure and registration monitoring terms",
        },
        {
          path: "/dashboard/glinks",
          purpose: "GloryLink client destination and module management",
          backlinkFocus: "Link from ministry profile and social setup docs",
          structuredContentType: "CollectionPage",
          metadataFocus: "GloryLink dashboard and module management terms",
        },
      ],
    };
  }
}
