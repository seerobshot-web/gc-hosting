import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";

const API_BASE_URL = process.env.GCH_API_URL ?? "http://localhost:3333";

declare module "next-auth" {
  interface Session extends DefaultSession {
    userId: string;
    accessToken: string;
  }
}

interface AppToken {
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  [key: string]: unknown;
}

interface ApiTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function refreshAccessToken(refreshToken: string): Promise<ApiTokenPair | null> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  return res.json();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) return null;

        const tokens: ApiTokenPair = await res.json();
        // Decode the JWT payload to pull userId — apps/api's access token
        // carries { sub, email }, no separate /me call needed here.
        const payloadSegment = tokens.accessToken.split(".")[1] ?? "";
        const payload = JSON.parse(
          Buffer.from(payloadSegment, "base64").toString(),
        ) as { sub: string; email: string };

        return {
          id: payload.sub,
          email: payload.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpires: Date.now() + tokens.expiresIn * 1000,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as AppToken;

      if (user) {
        // Initial sign-in — `user` here is exactly what authorize() returned.
        const u = user as {
          id: string;
          accessToken: string;
          refreshToken: string;
          accessTokenExpires: number;
        };
        t.userId = u.id;
        t.accessToken = u.accessToken;
        t.refreshToken = u.refreshToken;
        t.accessTokenExpires = u.accessTokenExpires;
        return t;
      }

      if (t.accessTokenExpires && Date.now() < t.accessTokenExpires) {
        return t;
      }

      // Access token expired — rotate via the refresh token.
      if (!t.refreshToken) return t;
      const refreshed = await refreshAccessToken(t.refreshToken);
      if (!refreshed) {
        // Refresh failed (revoked/expired) — drop the tokens so the
        // session callback below reflects a signed-out state.
        t.accessToken = undefined;
        t.refreshToken = undefined;
        return t;
      }
      t.accessToken = refreshed.accessToken;
      t.refreshToken = refreshed.refreshToken;
      t.accessTokenExpires = Date.now() + refreshed.expiresIn * 1000;
      return t;
    },
    async session({ session, token }) {
      const t = token as AppToken;
      session.userId = t.userId ?? "";
      session.accessToken = t.accessToken ?? "";
      return session;
    },
  },
});
