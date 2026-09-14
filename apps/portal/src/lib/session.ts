import { auth } from "./auth";

export interface Session {
  userId: string;
  email: string;
  accessToken: string;
  // orgId/role arrive once Stage 1 (Membership) exists — a logged-in User
  // isn't necessarily tied to a workspace yet on its own.
}

/**
 * Real implementation, replacing the earlier hard-stubbed always-null
 * placeholder. Backed by NextAuth (see ./auth.ts) — the JWT session cookie
 * carries apps/api's own access/refresh token pair, rotated automatically
 * in the jwt() callback when the access token expires.
 */
export async function getSession(): Promise<Session | null> {
  const nextAuthSession = await auth();
  if (!nextAuthSession?.accessToken) return null;

  return {
    userId: nextAuthSession.userId,
    email: nextAuthSession.user?.email ?? "",
    accessToken: nextAuthSession.accessToken,
  };
}
