import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __gchPrisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client — avoids exhausting the connection pool from
 * hot-reloaded Next.js dev servers importing this package repeatedly.
 */
export const prisma = globalThis.__gchPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__gchPrisma = prisma;
}
