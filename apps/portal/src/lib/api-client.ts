/**
 * Thin client for apps/api's OpenAPI-documented endpoints (docs at
 * /docs on the API app). Kept dependency-free rather than generating a
 * full OpenAPI SDK — swap for a generated client once the API's schema
 * stabilizes.
 */

const API_BASE_URL = process.env.GCH_API_URL ?? "http://localhost:3333";
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY;

export interface GLink {
  id: string;
  clientId: string;
  moduleType:
    | "LINK"
    | "GIVING_EXTERNAL"
    | "EVENT"
    | "SERMON_SERIES"
    | "ANNOUNCEMENT"
    | "SOCIAL_EMBED";
  label: string;
  url: string | null;
  position: number;
  isActive: boolean;
}

export interface DashboardOverview {
  infrastructure: {
    totalOrders: number;
    provisioningOrders: number;
    deployedOrders: number;
    failedOrders: number;
  };
  registrations: {
    totalClients: number;
    newLast7Days: number;
    recent: Array<{
      id: string;
      email: string;
      createdAt: string;
    }>;
  };
  rootTracking: Array<{
    id: string;
    primaryDomain: string;
    cpanelUsername: string;
    status: string;
    host: string;
    updatedAt: string;
    createdAt: string;
  }>;
  apiRouteHealth: Array<{
    method: "GET" | "POST" | "PATCH";
    path: string;
    status: "healthy" | "degraded" | "not_probed";
    detail: string;
  }>;
  pageDestinations: Array<{
    path: string;
    purpose: string;
    backlinkFocus: string;
    structuredContentType: string;
    metadataFocus: string;
  }>;
}

export async function getGLinksForClient(clientId: string): Promise<GLink[]> {
  const res = await fetch(
    `${API_BASE_URL}/glinks?clientId=${encodeURIComponent(clientId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Failed to load GLinks: ${res.status}`);
  }
  return res.json();
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const res = await fetch(`${API_BASE_URL}/dashboard/overview`, {
    cache: "no-store",
    headers: DASHBOARD_API_KEY
      ? { "x-dashboard-key": DASHBOARD_API_KEY }
      : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to load dashboard overview: ${res.status}`);
  }
  return res.json();
}
