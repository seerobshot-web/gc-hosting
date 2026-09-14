import { Injectable } from "@nestjs/common";
import { prisma } from "@gch/database";

interface GetOverviewInput {
  orgId?: string;
}

interface RouteHealth {
  method: "GET" | "POST" | "PATCH";
  path: string;
  status: "healthy" | "degraded";
  detail: string;
}

@Injectable()
export class DashboardService {
  private async getApiRouteHealth(orgId?: string): Promise<RouteHealth[]> {
    const clientWhere = orgId ? { orgId } : undefined;
    const orderWhere = orgId ? { client: { orgId } } : undefined;

    const checks = await Promise.allSettled([
      prisma.org.count(),
      prisma.client.count({ where: clientWhere }),
      prisma.gLink.count({ where: clientWhere }),
      prisma.provisioningOrder.count({ where: orderWhere }),
      prisma.auditLog.findFirst(),
    ]);

    const mapStatus = (result: PromiseSettledResult<unknown>) =>
      result.status === "fulfilled"
        ? { status: "healthy" as const, detail: "check passed" }
        : { status: "degraded" as const, detail: "check failed" };

    const orgsStatus = mapStatus(checks[0]);
    const clientsStatus = mapStatus(checks[1]);
    const glinksStatus = mapStatus(checks[2]);
    const provisioningStatus = mapStatus(checks[3]);
    const auditStatus = mapStatus(checks[4]);
    const dashboardStatus =
      checks.some((check) => check.status === "rejected")
        ? { status: "degraded" as const, detail: "dependency degraded" }
        : { status: "healthy" as const, detail: "all checks passed" };

    return [
      { method: "GET", path: "/orgs", ...orgsStatus },
      { method: "POST", path: "/orgs", ...orgsStatus },
      { method: "GET", path: "/orgs/:id", ...orgsStatus },
      { method: "GET", path: "/clients", ...clientsStatus },
      { method: "POST", path: "/clients", ...clientsStatus },
      { method: "GET", path: "/clients/:id", ...clientsStatus },
      { method: "GET", path: "/glinks", ...glinksStatus },
      { method: "POST", path: "/glinks", ...glinksStatus },
      { method: "PATCH", path: "/glinks/reorder", ...glinksStatus },
      { method: "PATCH", path: "/glinks/:id/deactivate", ...glinksStatus },
      { method: "GET", path: "/provisioning/orders/:clientId", ...provisioningStatus },
      { method: "POST", path: "/provisioning/orders", ...provisioningStatus },
      { method: "GET", path: "/audit", ...auditStatus },
      { method: "GET", path: "/dashboard/overview", ...dashboardStatus },
      { method: "GET", path: "/docs", ...dashboardStatus },
    ];
  }

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
      apiRouteHealth,
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
      this.getApiRouteHealth(input.orgId),
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
