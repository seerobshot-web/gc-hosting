import { can as canWithRole, type Permission } from "@gch/permissions";
import { auth } from "./auth";
import { getMe, type Role } from "./api-client";

export interface Session {
  userId: string;
  email: string;
  name: string | null;
  accessToken: string;
  /** Active workspace. Null for a user who belongs to no org yet. */
  org: { id: string; name: string; slug: string; role: Role } | null;
}

/**
 * UI-side gate reading the same map apps/api enforces with RolesGuard, so
 * hidden affordances and rejected requests can never drift apart. Hiding
 * is a courtesy; the api is still the enforcement point.
 */
export function can(session: Session | null, permission: Permission): boolean {
  return canWithRole(session?.org?.role, permission);
}

/**
 * Backed by NextAuth (see ./auth.ts) — the JWT session cookie carries
 * apps/api's own access/refresh token pair, rotated automatically in the
 * jwt() callback when the access token expires.
 *
 * The active org is resolved live from /users/me on every call rather than
 * baked into the cookie, so a role change or removal applies on the next
 * request instead of at next sign-in. v1 has no workspace switcher: the
 * user's first (oldest) membership is the active one.
 */
export async function getSession(): Promise<Session | null> {
  const nextAuthSession = await auth();
  if (!nextAuthSession?.accessToken) return null;

  const accessToken = nextAuthSession.accessToken;
  let me;
  try {
    me = await getMe(accessToken);
  } catch {
    // Token rejected server-side (revoked, or user deleted) — treat as
    // signed out rather than rendering a half-authenticated page.
    return null;
  }

  const active = me.memberships[0];
  return {
    userId: me.id,
    email: me.email,
    name: me.name,
    accessToken,
    org: active
      ? { ...active.org, role: active.role }
      : null,
  };
}
