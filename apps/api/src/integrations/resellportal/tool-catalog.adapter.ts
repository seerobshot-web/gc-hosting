import { randomUUID } from "node:crypto";
import { z } from "zod";

export type CatalogValueState = "verified" | "missing" | "unknown" | "stale" | "invalid";

export interface NormalizedCatalogValue<T> {
  state: CatalogValueState;
  value: T | null;
  note: string;
}

export interface CatalogContractGap {
  reason: string;
  verifiedFacts: readonly string[];
  missingFacts: readonly string[];
}

export interface CatalogAdapterConfig<TResponse, TRecord> {
  baseUrl: string;
  path: string;
  timeoutMs: number;
  requestHeaders: Record<string, string>;
  responseSchema: z.ZodType<TResponse>;
  normalize: (response: TResponse) => readonly TRecord[];
}

export type CatalogAdapterErrorType =
  | "contract-gap"
  | "timeout"
  | "auth"
  | "rate-limit"
  | "upstream"
  | "invalid-response";

export interface CatalogAdapterError {
  type: CatalogAdapterErrorType;
  message: string;
  correlationId: string;
  statusCode?: number;
  retryAfterSeconds?: number;
}

export type CatalogAdapterResult<TRecord> =
  | {
      ok: true;
      correlationId: string;
      records: readonly TRecord[];
      observedAt: string;
    }
  | {
      ok: false;
      error: CatalogAdapterError;
    };

export const resellPortalCatalogContractGap: CatalogContractGap = {
  reason:
    "Repository artifacts do not verify the public Tools catalog route, response schema, pagination, or storefront-mapping semantics for ResellPortal.",
  verifiedFacts: [
    "ResellPortal API usage in this repository is server-side only and keeps credentials out of the Astro app.",
    "Existing provisioning calls use X-API-Key and X-API-Secret headers against the ResellPortal base URL.",
  ],
  missingFacts: [
    "Read-only tools catalog endpoint path",
    "Request and response schema for catalog products",
    "Pagination rules",
    "Availability/status enum meanings",
    "Verified storefront identifiers and destinations",
  ],
};

function redactHeaders(headers: Record<string, string>) {
  return Object.fromEntries(Object.keys(headers).map((key) => [key, "[REDACTED]"]));
}

function toError(
  type: CatalogAdapterErrorType,
  correlationId: string,
  message: string,
  statusCode?: number,
  retryAfterSeconds?: number,
): CatalogAdapterResult<never> {
  return {
    ok: false,
    error: { type, message, correlationId, statusCode, retryAfterSeconds },
  };
}

export class ResellPortalToolCatalogAdapter<TResponse, TRecord> {
  constructor(
    private readonly config: CatalogAdapterConfig<TResponse, TRecord> | null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchCatalog(): Promise<CatalogAdapterResult<TRecord>> {
    const correlationId = randomUUID();
    if (!this.config) {
      return toError("contract-gap", correlationId, resellPortalCatalogContractGap.reason);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const headers = {
      Accept: "application/json",
      ...this.config.requestHeaders,
      "X-Correlation-Id": correlationId,
    };

    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}${this.config.path}`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        return toError("auth", correlationId, "Catalog request was rejected by the upstream service.", response.status);
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "");
        return toError(
          "rate-limit",
          correlationId,
          "Catalog request was rate limited by the upstream service.",
          response.status,
          Number.isFinite(retryAfter) ? retryAfter : undefined,
        );
      }

      if (!response.ok) {
        return toError(
          "upstream",
          correlationId,
          `Catalog request failed with upstream status ${response.status}.`,
          response.status,
        );
      }

      const payload = await response.json();
      const parsed = this.config.responseSchema.safeParse(payload);
      if (!parsed.success) {
        return toError(
          "invalid-response",
          correlationId,
          `Catalog response failed validation: ${parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join(", ")}`,
        );
      }

      return {
        ok: true,
        correlationId,
        records: this.config.normalize(parsed.data),
        observedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return toError("timeout", correlationId, "Catalog request timed out before the upstream service responded.");
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  describeConfigForLogs() {
    if (!this.config) {
      return {
        configured: false,
        headers: {},
      };
    }

    return {
      configured: true,
      baseUrl: this.config.baseUrl,
      path: this.config.path,
      timeoutMs: this.config.timeoutMs,
      headers: redactHeaders(this.config.requestHeaders),
    };
  }
}
