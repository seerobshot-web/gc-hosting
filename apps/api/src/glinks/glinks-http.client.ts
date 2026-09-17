import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Adapter for the legacy GLINKS VPS's versioned internal REST API.
 *
 * GLINKS is a black box on a separate host (see
 * docs/architecture/GLINKS-INTEGRATION.md): GCH never touches its database
 * and reaches it only through this HMAC-signed client. Every outbound
 * request carries:
 *   - X-Timestamp: unix-millis string, folded into the signature so a
 *     captured token can't be replayed indefinitely.
 *   - X-Internal-Token: HMAC-SHA256 over `${timestamp}:${body}` keyed by
 *     GLINKS_INTERNAL_SECRET.
 *
 * The signing core lives here (not inline in a service) so it has exactly
 * one implementation and one set of tests. Full typed request methods land
 * in Phase 6; this ships the adapter shell + the signature contract.
 */
export interface GlinksSignature {
  timestamp: string;
  token: string;
}

@Injectable()
export class GlinksHttpClient {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    const url = this.config.get<string>("GLINKS_BASE_URL");
    if (!url) {
      throw new Error("GLINKS_BASE_URL is not set — required to reach the GLINKS internal API.");
    }
    return url.replace(/\/$/, "");
  }

  private get signingSecret(): string {
    const secret = this.config.get<string>("GLINKS_INTERNAL_SECRET");
    if (!secret) {
      throw new Error(
        "GLINKS_INTERNAL_SECRET is not set — required to sign every GLINKS internal API call.",
      );
    }
    return secret;
  }

  /**
   * Deterministic given (timestamp, body, secret): the same inputs always
   * produce the same token, and any change to the secret changes the token.
   * Exposed for direct testing and reuse.
   */
  static computeToken(timestamp: string, body: string, secret: string): string {
    return createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex");
  }

  /** Builds the signing headers for a request body (defaults to now). */
  sign(body: string, timestamp: string = Date.now().toString()): GlinksSignature {
    return {
      timestamp,
      token: GlinksHttpClient.computeToken(timestamp, body, this.signingSecret),
    };
  }

  /**
   * Constant-time verification helper for tokens minted with the same
   * secret — used by tests and any future inbound-callback verification.
   */
  verify(timestamp: string, body: string, token: string): boolean {
    const expected = GlinksHttpClient.computeToken(timestamp, body, this.signingSecret);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Signed transport for the GLINKS internal API. Typed per-endpoint methods
   * (Phase 6) build on this; kept protected so nothing bypasses signing.
   */
  protected async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const method = init.method ?? "GET";
    const body = init.body === undefined ? "" : JSON.stringify(init.body);
    const { timestamp, token } = this.sign(body);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Timestamp": timestamp,
        "X-Internal-Token": token,
      },
      ...(body ? { body } : {}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GLINKS ${method} ${path} failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }
}
