/**
 * Thin client for apps/api's OpenAPI-documented endpoints (docs at
 * /docs on the API app). Kept dependency-free rather than generating a
 * full OpenAPI SDK — swap for a generated client once the API's schema
 * stabilizes.
 */

const API_BASE_URL = process.env.GCH_API_URL ?? "http://localhost:3333";

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
  method: "GET" | "POST",
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
  return res.json();
}

const apiGet = <T>(path: string, accessToken: string) => api<T>("GET", path, accessToken);

export function getPlans(accessToken: string): Promise<Plan[]> {
  return apiGet("/billing/plans", accessToken);
}

export function getBillingSubscription(
  orgId: string,
  accessToken: string,
): Promise<{ subscription: Subscription | null; seatsUsed: number }> {
  return apiGet(`/orgs/${encodeURIComponent(orgId)}/billing/subscription`, accessToken);
}

export function getInvoices(orgId: string, accessToken: string): Promise<Invoice[]> {
  return apiGet(`/orgs/${encodeURIComponent(orgId)}/billing/invoices`, accessToken);
}

export function createCheckoutSession(
  orgId: string,
  planId: string,
  accessToken: string,
): Promise<{ url: string | null }> {
  return api("POST", `/orgs/${encodeURIComponent(orgId)}/billing/checkout-session`, accessToken, {
    planId,
  });
}

export function createPortalSession(
  orgId: string,
  accessToken: string,
): Promise<{ url: string }> {
  return api("POST", `/orgs/${encodeURIComponent(orgId)}/billing/portal-session`, accessToken);
}

export function getMe(accessToken: string): Promise<Me> {
  return apiGet("/users/me", accessToken);
}

export function getClientsForOrg(orgId: string, accessToken: string): Promise<Client[]> {
  return apiGet(`/clients?orgId=${encodeURIComponent(orgId)}`, accessToken);
}

export function getGLinksForClient(clientId: string, accessToken: string): Promise<GLink[]> {
  return apiGet(`/glinks?clientId=${encodeURIComponent(clientId)}`, accessToken);
}
