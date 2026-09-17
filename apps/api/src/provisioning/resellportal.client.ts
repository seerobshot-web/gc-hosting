import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

export interface CreateOrderInput {
  productKey: "web_hosting";
  clientId: string;
  cpanelUsername: string;
  primaryDomain: string;
}

// Responses from ResellPortal are never trusted blindly — each is parsed
// through the matching zod schema before it reaches the rest of the app, so
// a shape change surfaces as a clear validation error at the boundary
// instead of an undefined-property crash three layers deep.
const findOrCreateClientSchema = z.object({
  client_id: z.string(),
  portal_credentials: z.unknown().optional(),
});

const placeOrderSchema = z.object({
  order_id: z.string(),
});

const serviceSchema = z.object({
  id: z.string(),
  deployment_status: z.string(),
  next_billing_date: z.string().nullable(),
});
const servicesSchema = z.array(serviceSchema);

export type ResellPortalService = z.infer<typeof serviceSchema>;

/**
 * Thin wrapper around ResellPortal's wholesale provisioning API.
 *
 * Two facts drive every method here:
 *  1. It's request-only — there are no webhooks, so "did this succeed" can
 *     only ever be answered by polling GET /services.
 *  2. There is no sandbox environment — test_mode on /orders is the only
 *     way to validate integration code without charging the wallet balance
 *     or provisioning a real cPanel account.
 *
 * Live ordering is intentionally disabled while ALEPH is being consolidated.
 * Re-enable it only after the Stripe -> GCH Order -> durable provisioning job
 * path exists and has an approved release gate.
 */
@Injectable()
export class ResellPortalClient {
  private static readonly DEFAULT_BASE_URL =
    "https://panel.resellportal.com/wp-json/resellportal/v1";

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>("RESELLPORTAL_BASE_URL") ?? ResellPortalClient.DEFAULT_BASE_URL
    );
  }

  /**
   * Deterministic idempotency key for a mutating operation, so a retry of
   * the *same* operation reuses the same key and ResellPortal collapses the
   * duplicate instead of provisioning twice. Derived from operation identity
   * (never a random UUID) per docs/architecture/IDEMPOTENCY.md.
   */
  static idempotencyKey(entityType: string, entityId: string, operationName: string): string {
    return createHash("sha256")
      .update(`${entityType}:${entityId}:${operationName}`)
      .digest("hex");
  }

  private get apiKey(): string {
    const key = this.config.get<string>("RESELLPORTAL_API_KEY");
    if (!key) {
      throw new Error(
        "RESELLPORTAL_API_KEY is not set — required for any ResellPortal call, including test_mode ones.",
      );
    }
    return key;
  }

  private get apiSecret(): string {
    const secret = this.config.get<string>("RESELLPORTAL_API_SECRET");
    if (!secret) {
      throw new Error(
        "RESELLPORTAL_API_SECRET is not set — the API requires both X-API-Key and X-API-Secret on every call.",
      );
    }
    return secret;
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "X-API-Secret": this.apiSecret,
        ...init.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ResellPortal ${path} failed: ${res.status} ${body}`);
    }

    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `ResellPortal ${path} returned an unexpected shape: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  findOrCreateClient(input: { email: string; name: string }) {
    return this.request("/clients", findOrCreateClientSchema, {
      method: "POST",
      body: JSON.stringify(input),
      headers: {
        "Idempotency-Key": ResellPortalClient.idempotencyKey(
          "client",
          input.email,
          "findOrCreateClient",
        ),
      },
    });
  }

  // NOTE: the only documented POST /orders example uses
  // product_key: "ai_business_tools" with a body shaped { ai_tools: [...] }
  // and a response of { service_id, tools_activated, amount_charged,
  // new_balance, client_credentials } — there is no order_id field and no
  // documented "web_hosting" product_key or its request/response shape.
  // This method's body/response types are unverified against the real API
  // and need confirming (or a real web_hosting example) before this is
  // trusted in production.
  placeOrder(input: CreateOrderInput) {
    return this.request("/orders", placeOrderSchema, {
      method: "POST",
      body: JSON.stringify({
        product_key: input.productKey,
        client_id: input.clientId,
        cpanel_username: input.cpanelUsername,
        primary_domain: input.primaryDomain,
        test_mode: true,
      }),
      headers: {
        "Idempotency-Key": ResellPortalClient.idempotencyKey(
          "provisioning_order",
          input.clientId,
          "placeOrder",
        ),
      },
    });
  }

  // NOTE: deployment_status appears in the documented GET /orders response,
  // not the GET /services example — this may need to poll /orders instead
  // once web_hosting's real order shape is confirmed.
  getServices(clientId: string) {
    return this.request(
      `/services?client_id=${encodeURIComponent(clientId)}`,
      servicesSchema,
    );
  }
}
