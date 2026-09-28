/**
 * Thin client for apps/api's OpenAPI-documented endpoints (docs at
 * /docs on the API app). Kept dependency-free rather than generating a
 * full OpenAPI SDK — swap for a generated client once the API's schema
 * stabilizes.
 */

import type { GLinkModuleType } from "@gch/database";

const API_BASE_URL = process.env.GCH_API_URL ?? "http://localhost:3333";
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY;

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface Me {
  id: string;
  email: string;
  name: string | null;
  memberships: Array<{
    id: string;
    role: Role;
    status: string;
    org: { id: string; name: string; slug: string };
  }>;
}

export interface Client {
  id: string;
  orgId: string;
  email: string;
  userId: string | null;
}

export interface GLink {
  id: string;
  clientId: string;
  moduleType: GLinkModuleType;
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

export interface Plan {
  id: string;
  name: string;
  seatLimit: number | null;
  pricePerSeatCents: number;
}

export interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  seatsPurchased: number;
  plan: Plan | null;
}

export interface Invoice {
  id: string;
  status: string;
  currency: string;
  amountDueCents: number;
  amountPaidCents: number;
  hostedInvoiceUrl: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `API ${method} ${path} failed: ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string | string[] };
      if (err.message) message = Array.isArray(err.message) ? err.message.join(", ") : err.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const apiGet = <T>(path: string, accessToken: string) => api<T>("GET", path, accessToken);

// ---- team / invitations / org settings ------------------------------------

export interface Member {
  id: string;
  role: Role;
  status: string;
  createdAt: string;
  user: { id: string; email: string | null; name: string | null };
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; email: string; name: string | null };
}

export interface InvitationPreview {
  orgName: string;
  email: string;
  role: Role;
  invitedBy: string;
  expiresAt: string;
  hasAccount: boolean;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  autoJoinDomain: string | null;
}

export interface DomainVerification {
  id: string;
  domain: string;
  verifiedAt: string | null;
  dns?: { type: string; host: string; value: string };
}

const org = (orgId: string) => `/orgs/${encodeURIComponent(orgId)}`;

export const getMembers = (orgId: string, t: string) =>
  apiGet<Member[]>(`${org(orgId)}/memberships`, t);
export const changeMemberRole = (orgId: string, id: string, role: Role, t: string) =>
  api<Member>("PATCH", `${org(orgId)}/memberships/${id}`, t, { role });
export const removeMember = (orgId: string, id: string, t: string) =>
  api<void>("DELETE", `${org(orgId)}/memberships/${id}`, t);

export const getInvitations = (orgId: string, t: string) =>
  apiGet<Invitation[]>(`${org(orgId)}/invitations`, t);
export const createInvitation = (orgId: string, email: string, role: Role, t: string) =>
  api<Invitation>("POST", `${org(orgId)}/invitations`, t, { email, role });
export const resendInvitation = (orgId: string, id: string, t: string) =>
  api<Invitation>("POST", `${org(orgId)}/invitations/${id}/resend`, t);
export const revokeInvitation = (orgId: string, id: string, t: string) =>
  api<void>("DELETE", `${org(orgId)}/invitations/${id}`, t);

export const getInvitationPreview = (token: string) =>
  apiPublic<InvitationPreview>("GET", `/invitations/${encodeURIComponent(token)}`);
export const acceptInvitation = (
  token: string,
  body: { password?: string; name?: string },
  accessToken?: string,
) =>
  apiPublic<{
    orgId: string;
    orgSlug: string;
    role: Role;
    tokens: { accessToken: string; refreshToken: string; expiresIn: number } | null;
  }>("POST", `/invitations/${encodeURIComponent(token)}/accept`, body, accessToken);

export const getOrg = (orgId: string, t: string) => apiGet<Org>(org(orgId), t);
export const updateOrg = (
  orgId: string,
  body: { name?: string; autoJoinDomain?: string | null },
  t: string,
) => api<Org>("PATCH", org(orgId), t, body);
export const updateMe = (body: { name?: string }, t: string) =>
  api<Me>("PATCH", "/users/me", t, body);

export const getDomains = (orgId: string, t: string) =>
  apiGet<DomainVerification[]>(`${org(orgId)}/domains`, t);
export const createDomain = (orgId: string, domain: string, t: string) =>
  api<DomainVerification>("POST", `${org(orgId)}/domains`, t, { domain });
export const verifyDomain = (orgId: string, id: string, t: string) =>
  api<DomainVerification>("POST", `${org(orgId)}/domains/${id}/verify`, t);

// ---- public/auth helpers ----------------------------------------------------

async function apiPublic<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  bodyOrAccessToken?: unknown,
  maybeAccessToken?: string,
): Promise<T> {
  const hasBody = method !== "GET" && bodyOrAccessToken !== undefined && typeof bodyOrAccessToken !== "string";
  const accessToken = hasBody ? maybeAccessToken : typeof bodyOrAccessToken === "string" ? bodyOrAccessToken : undefined;
  const body = hasBody ? bodyOrAccessToken : undefined;
  const headers: Record<string, string> = {
    ...(DASHBOARD_API_KEY ? { "x-dashboard-key": DASHBOARD_API_KEY } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    cache: "no-store",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `API ${method} ${path} failed: ${res.status}`;
    try {
      const err = (await res.json()) as { message?: string | string[] };
      if (err.message) message = Array.isArray(err.message) ? err.message.join(", ") : err.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
