import { cookies } from "next/headers";

export interface Session {
  clientId: string;
  orgId: string;
  email: string;
}

const SESSION_COOKIE = "gch_session";

/**
 * Auth scaffold — intentionally NOT wired to a fake/hardcoded user.
 *
 * Structure is in place (cookie read, typed Session shape, a single
 * getSession() call site every route uses) so a real provider (NextAuth,
 * Lucia, or a custom JWT-over-cookie scheme backed by FOSSBilling's client
 * record) can be dropped in here without every calling route changing.
 *
 * Currently returns null always — every route that calls this must handle
 * the unauthenticated case; there is deliberately no bypass.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  // TODO: verify + decode the real session token once an auth provider is
  // wired in. Do not decode unsigned/untrusted cookie contents here.
  return null;
}
