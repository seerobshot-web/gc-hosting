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

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`API GET ${path} failed: ${res.status}`);
  }
  return res.json();
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
