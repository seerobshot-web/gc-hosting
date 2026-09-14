import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface CreateOrderInput {
  productKey: "web_hosting";
  clientId: string;
  cpanelUsername: string;
  primaryDomain: string;
}

export interface ResellPortalService {
  id: string;
  deployment_status: "installing" | "deployed" | string;
  next_billing_date: string | null;
}

/**
 * Thin wrapper around ResellPortal's wholesale provisioning API.
 *
 * Two facts drive every method here:
 *  1. It's request-only — there are no webhooks, so "did this succeed" can
 *     only ever be answered by polling GET /services.
 *  2. There is no sandbox environment — test_mode on /orders is the only
 *     way to validate integration code without charging the wallet balance
 *     or provisioning a real cPanel account. Every call from a dev/test
 *     environment MUST set test_mode: true.
 */
@Injectable()
export class ResellPortalClient {
  private readonly baseUrl = "https://panel.resellportal.com/wp-json/resellportal/v1";

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    const key = this.config.get<string>("RESELLPORTAL_API_KEY");
    if (!key) {
      throw new Error(
        "RESELLPORTAL_API_KEY is not set — required for any ResellPortal call, including test_mode ones.",
      );
    }
    return key;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...init.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ResellPortal ${path} failed: ${res.status} ${body}`);
    }

    return res.json() as Promise<T>;
  }

  findOrCreateClient(input: { email: string; name: string }) {
    return this.request<{ id: string }>("/clients", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  placeOrder(input: CreateOrderInput) {
    const nodeEnv = this.config.get<string>("NODE_ENV");
    let testMode = true;

    if (nodeEnv === "production") {
      const configuredTestMode = this.config.get<string | boolean>(
        "RESELLPORTAL_TEST_MODE",
      );

      if (configuredTestMode !== true && configuredTestMode !== false) {
        if (configuredTestMode === "true") testMode = true;
        else if (configuredTestMode === "false") testMode = false;
        else {
          throw new Error(
            "RESELLPORTAL_TEST_MODE must be explicitly set to true or false in production.",
          );
        }
      } else {
        testMode = configuredTestMode;
      }
    }

    return this.request<{ order_id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        product_key: input.productKey,
        client_id: input.clientId,
        cpanel_username: input.cpanelUsername,
        primary_domain: input.primaryDomain,
        // Never let a dev/test script place a real wholesale order.
        test_mode: testMode,
      }),
    });
  }

  getServices(clientId: string) {
    return this.request<ResellPortalService[]>(
      `/services?client_id=${encodeURIComponent(clientId)}`,
    );
  }
}
