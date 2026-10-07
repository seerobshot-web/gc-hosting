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

export interface SafePlaceOrderInput {
  clientId: string;
  productKey: string;
  billingCycle?: string;
  skipClientEmail?: boolean;
  orderPayload?: Record<string, unknown>;
}

export type SafePlaceOrderResult =
  | {
      kind: "placed";
      order: ResellPortalOrderResponse;
    }
  | {
      kind: "already-fulfilled";
      serviceId: string;
      source: "precheck" | "duplicate_service";
    };

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

const orderResponseSchema = z
  .object({
    service_id: z.string(),
    amount_charged: z.union([z.string(), z.number()]).optional(),
    new_balance: z.union([z.string(), z.number()]).optional(),
    client_credentials: z.unknown().optional(),
    client_access_url: z.string().optional(),
  })
  .passthrough();

const duplicateServiceSchema = z
  .object({
    service_id: z.string(),
    code: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

const serviceSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
  deployment_status: z.string(),
  product_key: z.string().optional(),
  billing_cycle: z.string().nullable().optional(),
  service_data: z.record(z.string(), z.unknown()).optional(),
  next_billing_date: z.string().nullable(),
});
const servicesSchema = z.array(serviceSchema);

export type ResellPortalService = z.infer<typeof serviceSchema>;
export type ResellPortalOrderResponse = z.infer<typeof orderResponseSchema>;

// Response shape for the lifecycle endpoints used by the GCH-ALEPH provisioning
// orchestrator (create / suspend / reactivate / terminate / status). Kept
// separate from the legacy `serviceSchema` (which mirrors the poller's
// GET /services shape). Every lifecycle response is validated through this
// before it reaches ProvisioningService, so a shape drift fails loudly at the
// boundary instead of corrupting a ProviderService row.
const providerServiceSchema = z.object({
  service_id: z.string(),
  status: z.string(),
});

export type ProviderServiceResponse = z.infer<typeof providerServiceSchema>;

/** Params for provisioning a brand-new ResellPortal service for a GCH order. */
export interface CreateServiceParams {
  orderId: string;
  planId: string;
  orgId: string;
}

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
      throw new Error(`ResellPortal ${path} failed: ${res.status}`);
    }

    let json: unknown;
    try { json = await res.json(); }
    catch { throw new Error(`ResellPortal ${path} returned invalid JSON`); }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `ResellPortal ${path} returned an unexpected shape`,
      );
    }
    return parsed.data;
  }

  private async requestWithStatus(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; ok: boolean; bodyText: string; bodyJson: unknown | undefined }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "X-API-Secret": this.apiSecret,
        ...init.headers,
      },
    });

    const bodyText = await res.text();
    let bodyJson: unknown | undefined;
    try {
      bodyJson = bodyText.length > 0 ? JSON.parse(bodyText) : undefined;
    } catch {
      bodyJson = undefined;
    }

    return { status: res.status, ok: res.ok, bodyText: this.redactSecrets(bodyText), bodyJson };
  }

  private redactSecrets(value: string): string {
    return value
      .replaceAll(this.apiKey, "[REDACTED]")
      .replaceAll(this.apiSecret, "[REDACTED]");
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

  getServiceById(serviceId: string) {
    return this.request(`/services/${encodeURIComponent(serviceId)}`, serviceSchema);
  }

  async findExistingServiceForProduct(
    clientId: string,
    productKey: string,
    billingCycle?: string,
  ): Promise<ResellPortalService | null> {
    const services = await this.getServices(clientId);
    const match = services.find((service) =>
      matchesProductKeyAndCycle(service, productKey, billingCycle),
    );
    return match ?? null;
  }

  async safePlaceOrder(input: SafePlaceOrderInput): Promise<SafePlaceOrderResult> {
    const existing = await this.findExistingServiceForProduct(
      input.clientId,
      input.productKey,
      input.billingCycle,
    );
    if (existing) {
      return { kind: "already-fulfilled", serviceId: existing.id, source: "precheck" };
    }

    const response = await this.requestWithStatus("/orders", {
      method: "POST",
      body: JSON.stringify({
        ...(input.orderPayload ?? {}),
        client_id: input.clientId,
        product_key: input.productKey,
        test_mode: true,
        ...(input.skipClientEmail === undefined
          ? {}
          : { skip_client_email: input.skipClientEmail }),
      }),
    });

    if (response.status === 409) {
      const duplicate = duplicateServiceSchema.safeParse(response.bodyJson);
      if (
        duplicate.success &&
        (duplicate.data.code === "duplicate_service" || duplicate.data.error === "duplicate_service")
      ) {
        return {
          kind: "already-fulfilled",
          serviceId: duplicate.data.service_id,
          source: "duplicate_service",
        };
      }
    }

    if (!response.ok) {
      throw new Error(`ResellPortal /orders failed: ${response.status}`);
    }

    const parsed = orderResponseSchema.safeParse(response.bodyJson);
    if (!parsed.success) {
      throw new Error(`ResellPortal /orders returned an unexpected shape`);
    }

    return { kind: "placed", order: parsed.data };
  }

  // ---------------------------------------------------------------------------
  // GCH-ALEPH service lifecycle (Phase 5).
  //
  // These are the durable, idempotent lifecycle mutations the provisioning
  // orchestrator drives from the order state machine. Unlike the legacy
  // placeOrder/getServices poller pair, each takes an EXPLICIT deterministic
  // idempotencyKey (computed by the caller from the entity it is acting on) and
  // forwards it as the `Idempotency-Key` header, so ResellPortal collapses a
  // retried mutation instead of double-provisioning / double-terminating.
  // Every response is parsed through providerServiceSchema.
  // ---------------------------------------------------------------------------

  /** Provision a new service for a paid order. Idempotent via the header. */
  createService(
    params: CreateServiceParams,
    idempotencyKey: string,
  ): Promise<ProviderServiceResponse> {
    return this.request("/services", providerServiceSchema, {
      method: "POST",
      body: JSON.stringify({
        order_id: params.orderId,
        plan_id: params.planId,
        org_id: params.orgId,
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
  }

  /** Suspend an active service (e.g. on payment failure / cancellation). */
  suspendService(
    resellPortalId: string,
    idempotencyKey: string,
  ): Promise<ProviderServiceResponse> {
    return this.request(
      `/services/${encodeURIComponent(resellPortalId)}/suspend`,
      providerServiceSchema,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
    );
  }

  /** Reactivate a previously suspended service. */
  reactivateService(
    resellPortalId: string,
    idempotencyKey: string,
  ): Promise<ProviderServiceResponse> {
    return this.request(
      `/services/${encodeURIComponent(resellPortalId)}/reactivate`,
      providerServiceSchema,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
    );
  }

  /** Permanently terminate a service. */
  terminateService(
    resellPortalId: string,
    idempotencyKey: string,
  ): Promise<ProviderServiceResponse> {
    return this.request(
      `/services/${encodeURIComponent(resellPortalId)}/terminate`,
      providerServiceSchema,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
    );
  }

  /**
   * Read the current status of a service. Read-only, but still accepts an
   * idempotencyKey (forwarded as a header) for a uniform adapter surface.
   */
  getServiceStatus(
    resellPortalId: string,
    idempotencyKey: string,
  ): Promise<ProviderServiceResponse> {
    return this.request(
      `/services/${encodeURIComponent(resellPortalId)}`,
      providerServiceSchema,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
  }
}

function matchesProductKeyAndCycle(
  service: ResellPortalService,
  productKey: string,
  billingCycle?: string,
): boolean {
  const topLevelProductKey = service.product_key;
  const serviceDataProductKey =
    typeof service.service_data?.product_key === "string" ? service.service_data.product_key : null;
  const serviceDataServiceType =
    typeof service.service_data?.service_type === "string"
      ? service.service_data.service_type
      : null;

  const productMatches =
    topLevelProductKey === productKey ||
    serviceDataProductKey === productKey ||
    serviceDataServiceType === productKey;
  if (!productMatches) return false;

  if (!billingCycle) return true;
  if (!service.billing_cycle) return true;
  return service.billing_cycle === billingCycle;
}
