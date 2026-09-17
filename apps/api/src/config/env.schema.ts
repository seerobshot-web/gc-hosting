import { z } from "zod";

/**
 * Single source of truth for the environment apps/api needs to run safely.
 *
 * Every variable the API depends on is declared here so a misconfigured
 * deployment fails fast and loudly at boot (see validateEnv + the guard in
 * main.ts) rather than at the first request that happens to touch a missing
 * secret. Keep this in sync with the repo-root .env.example.
 *
 * Secrets are validated by presence/shape only — their VALUES are never
 * logged or echoed anywhere.
 */
export const envSchema = z.object({
  // --- Core / database ---
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // --- Auth ---
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  DASHBOARD_API_KEY: z.string().min(1, "DASHBOARD_API_KEY is required"),

  // --- Stripe billing ---
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),

  // --- ResellPortal provisioning ---
  RESELLPORTAL_API_KEY: z.string().min(1, "RESELLPORTAL_API_KEY is required"),
  RESELLPORTAL_API_SECRET: z.string().min(1, "RESELLPORTAL_API_SECRET is required"),
  RESELLPORTAL_BASE_URL: z.string().url("RESELLPORTAL_BASE_URL must be a valid URL"),

  // --- GLINKS internal API ---
  GLINKS_INTERNAL_SECRET: z.string().min(1, "GLINKS_INTERNAL_SECRET is required"),
  GLINKS_BASE_URL: z.string().url("GLINKS_BASE_URL must be a valid URL"),

  // --- CORS ---
  ALLOWED_ORIGINS: z
    .string()
    .min(1, "ALLOWED_ORIGINS is required (comma-separated origin allowlist)"),

  // --- Optional (have safe defaults elsewhere) ---
  PORT: z.string().regex(/^\d+$/, "PORT must be numeric").optional(),
  GCH_PORTAL_ORIGIN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export interface EnvValidationResult {
  success: boolean;
  /** Variable NAMES that failed validation — never their values. */
  invalidVars: string[];
  /** Human-readable, value-free summary suitable for logging. */
  message: string;
  data?: Env;
}

/**
 * Validates the given environment against envSchema.
 *
 * Returns which variable NAMES failed (never their values), so the caller
 * can log the failure and exit without leaking secrets.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const result = envSchema.safeParse(env);
  if (result.success) {
    return { success: true, invalidVars: [], message: "OK", data: result.data };
  }

  const invalidVars = Array.from(
    new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "unknown"))),
  ).sort();

  return {
    success: false,
    invalidVars,
    message: `Invalid or missing environment variables: ${invalidVars.join(", ")}`,
  };
}
