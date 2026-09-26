import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import {
  CreateOrderInput,
  ResellPortalClient,
} from "./resellportal.client";

const originalFetch = globalThis.fetch;

const order: CreateOrderInput = {
  productKey: "web_hosting",
  clientId: "client-1",
  cpanelUsername: "example",
  primaryDomain: "example.com",
};

function clientFor(values: Record<string, string | boolean | undefined>) {
  const config = {
    get: (key: string) => values[key],
  } as ConfigService;

  return new ResellPortalClient(config);
}

function captureRequestBody() {
  let body: Record<string, unknown> | undefined;

  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ order_id: "order-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  return () => body;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ResellPortalClient.placeOrder", () => {
  for (const nodeEnv of ["development", "test", "production", undefined]) {
    it(`enables test mode when NODE_ENV is ${String(nodeEnv)}`, async () => {
      const requestBody = captureRequestBody();
      const client = clientFor({
        NODE_ENV: nodeEnv,
        RESELLPORTAL_API_KEY: "api-key",
        RESELLPORTAL_API_SECRET: "api-secret",
      });

      await client.placeOrder(order);

      assert.equal(requestBody()?.test_mode, true);
    });
  }

  it("ignores obsolete production settings that previously enabled live orders", async () => {
    const requestBody = captureRequestBody();
    const client = clientFor({
      NODE_ENV: "production",
      RESELLPORTAL_API_KEY: "api-key",
      RESELLPORTAL_API_SECRET: "api-secret",
      RESELLPORTAL_TEST_MODE: "false",
    });

    await client.placeOrder(order);

    assert.equal(requestBody()?.test_mode, true);
  });

  it("does not allow caller-provided false to disable test mode", async () => {
    const requestBody = captureRequestBody();
    const client = clientFor({
      NODE_ENV: "development",
      RESELLPORTAL_API_KEY: "api-key",
      RESELLPORTAL_API_SECRET: "api-secret",
    });
    const untrustedInput = { ...order, testMode: false } as CreateOrderInput;

    await client.placeOrder(untrustedInput);

    assert.equal(requestBody()?.test_mode, true);
  });
});

describe("ResellPortalClient.idempotencyKey", () => {
  it("is a deterministic sha256(entityType:entityId:operationName)", () => {
    const expected = createHash("sha256")
      .update("provisioning_order:client-1:placeOrder")
      .digest("hex");

    const a = ResellPortalClient.idempotencyKey("provisioning_order", "client-1", "placeOrder");
    const b = ResellPortalClient.idempotencyKey("provisioning_order", "client-1", "placeOrder");

    assert.equal(a, expected);
    assert.equal(a, b); // same operation identity -> same key (safe to retry)
  });

  it("differs when any component of the operation identity differs", () => {
    const base = ResellPortalClient.idempotencyKey("provisioning_order", "client-1", "placeOrder");
    assert.notEqual(base, ResellPortalClient.idempotencyKey("client", "client-1", "placeOrder"));
    assert.notEqual(base, ResellPortalClient.idempotencyKey("provisioning_order", "client-2", "placeOrder"));
    assert.notEqual(base, ResellPortalClient.idempotencyKey("provisioning_order", "client-1", "getServices"));
  });
});

describe("ResellPortalClient service lifecycle", () => {
  function captureRequest(responseBody: unknown) {
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    globalThis.fetch = async (input, init) => {
      captured = { url: String(input), init };
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    return () => captured;
  }

  const creds = { RESELLPORTAL_API_KEY: "api-key", RESELLPORTAL_API_SECRET: "api-secret" };

  it("createService parses the response and forwards the idempotency key header", async () => {
    const captured = captureRequest({ service_id: "svc-1", status: "active" });
    const client = clientFor(creds);

    const res = await client.createService(
      { orderId: "order-1", planId: "plan-1", orgId: "org-1" },
      "idem-key-1",
    );

    assert.deepEqual(res, { service_id: "svc-1", status: "active" });
    const headers = captured()?.init?.headers as Record<string, string>;
    assert.equal(headers["Idempotency-Key"], "idem-key-1");
    assert.ok(captured()?.url.endsWith("/services"));
  });

  for (const method of ["suspendService", "reactivateService", "terminateService"] as const) {
    it(`${method} forwards the idempotency key header`, async () => {
      const captured = captureRequest({ service_id: "svc-1", status: "changed" });
      const client = clientFor(creds);

      const res = await client[method]("svc-1", `key-${method}`);

      assert.equal(res.service_id, "svc-1");
      const headers = captured()?.init?.headers as Record<string, string>;
      assert.equal(headers["Idempotency-Key"], `key-${method}`);
    });
  }

  it("getServiceStatus reads the status and forwards the idempotency key header", async () => {
    const captured = captureRequest({ service_id: "svc-1", status: "active" });
    const client = clientFor(creds);

    const res = await client.getServiceStatus("svc-1", "status-key");

    assert.equal(res.status, "active");
    const headers = captured()?.init?.headers as Record<string, string>;
    assert.equal(headers["Idempotency-Key"], "status-key");
  });

  it("rejects a malformed lifecycle response (zod parse failure at the boundary)", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ wrong: "shape" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const client = clientFor(creds);

    await assert.rejects(
      client.createService({ orderId: "o", planId: "p", orgId: "g" }, "k"),
      /unexpected shape/,
    );
  });
});

describe("ResellPortalClient mutating requests", () => {
  it("send a deterministic Idempotency-Key header on placeOrder", async () => {
    let headers: Record<string, string> | undefined;
    globalThis.fetch = async (_input, init) => {
      headers = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ order_id: "order-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = clientFor({
      RESELLPORTAL_API_KEY: "api-key",
      RESELLPORTAL_API_SECRET: "api-secret",
    });
    await client.placeOrder(order);

    assert.equal(
      headers?.["Idempotency-Key"],
      ResellPortalClient.idempotencyKey("provisioning_order", "client-1", "placeOrder"),
    );
  });
});

describe("ResellPortalClient.safePlaceOrder", () => {
  const creds = { RESELLPORTAL_API_KEY: "api-key", RESELLPORTAL_API_SECRET: "api-secret" };
  const fixtureProductKey = "fixture_product_key";

  it("returns an already-fulfilled result from the pre-check and skips POST /orders", async () => {
    const calls: Array<{ url: string; method: string | undefined }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method });
      return new Response(
        JSON.stringify([
          {
            id: "svc-existing",
            deployment_status: "active",
            next_billing_date: null,
            product_key: fixtureProductKey,
            billing_cycle: "monthly",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = clientFor(creds);
    const result = await client.safePlaceOrder({
      clientId: "client-1",
      productKey: fixtureProductKey,
      billingCycle: "monthly",
      orderPayload: { fixture_option: true },
    });

    assert.deepEqual(result, {
      kind: "already-fulfilled",
      serviceId: "svc-existing",
      source: "precheck",
    });
    assert.equal(calls.length, 1);
    assert.ok(calls[0]?.url.endsWith("/services?client_id=client-1"));
  });

  it("calls POST /orders exactly once when pre-check finds no matching service", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      if (String(input).includes("/services?")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          service_id: "svc-created",
          amount_charged: "9.99",
          new_balance: "90.01",
          extra_field: "kept",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = clientFor(creds);
    const result = await client.safePlaceOrder({
      clientId: "client-1",
      productKey: fixtureProductKey,
      orderPayload: { fixture_option: "value" },
      skipClientEmail: true,
    });

    assert.equal(result.kind, "placed");
    if (result.kind === "placed") {
      assert.equal(result.order.service_id, "svc-created");
      assert.equal(result.order.extra_field, "kept");
    }

    const orderCalls = calls.filter((call) => call.url.endsWith("/orders"));
    assert.equal(orderCalls.length, 1);
    const body = JSON.parse(String(orderCalls[0]?.init?.body)) as Record<string, unknown>;
    assert.equal(body.test_mode, true);
    assert.equal(body.skip_client_email, true);
    assert.equal(body.client_id, "client-1");
    assert.equal(body.product_key, fixtureProductKey);
  });

  it("does not treat a cycle-less service as a match when a billing cycle is requested", async () => {
    const calls: Array<{ url: string }> = [];
    globalThis.fetch = async (input) => {
      calls.push({ url: String(input) });
      if (String(input).includes("/services?")) {
        return new Response(
          JSON.stringify([
            {
              id: "svc-without-cycle",
              deployment_status: "active",
              next_billing_date: null,
              product_key: fixtureProductKey,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ service_id: "svc-created" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = clientFor(creds);
    const result = await client.safePlaceOrder({
      clientId: "client-1",
      productKey: fixtureProductKey,
      billingCycle: "monthly",
    });

    assert.equal(result.kind, "placed");
    assert.equal(calls.filter((call) => call.url.endsWith("/orders")).length, 1);
  });

  it("ignores inactive matching services during pre-check", async () => {
    const calls: Array<{ url: string }> = [];
    globalThis.fetch = async (input) => {
      calls.push({ url: String(input) });
      if (String(input).includes("/services?")) {
        return new Response(
          JSON.stringify([
            {
              id: "svc-inactive",
              status: "cancelled",
              deployment_status: "terminated",
              next_billing_date: null,
              product_key: fixtureProductKey,
              billing_cycle: "monthly",
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ service_id: "svc-created" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = clientFor(creds);
    const result = await client.safePlaceOrder({
      clientId: "client-1",
      productKey: fixtureProductKey,
      billingCycle: "monthly",
    });

    assert.equal(result.kind, "placed");
    assert.equal(calls.filter((call) => call.url.endsWith("/orders")).length, 1);
  });

  it("normalizes 409 duplicate_service into already-fulfilled", async () => {
    globalThis.fetch = async (input) => {
      if (String(input).includes("/services?")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          code: "duplicate_service",
          service_id: "svc-duplicate",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = clientFor(creds);
    const result = await client.safePlaceOrder({
      clientId: "client-1",
      productKey: fixtureProductKey,
    });

    assert.deepEqual(result, {
      kind: "already-fulfilled",
      serviceId: "svc-duplicate",
      source: "duplicate_service",
    });
  });

  it("allows callers to override safePlaceOrder test_mode when explicitly requested", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      if (String(input).includes("/services?")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ service_id: "svc-created" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = clientFor(creds);
    const result = await client.safePlaceOrder({
      clientId: "client-1",
      productKey: fixtureProductKey,
      testMode: false,
    });

    assert.equal(result.kind, "placed");
    assert.equal(capturedBody?.test_mode, false);
  });

  it("rejects malformed POST /orders responses", async () => {
    globalThis.fetch = async (input) => {
      if (String(input).includes("/services?")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ order_id: "legacy-only" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = clientFor(creds);

    await assert.rejects(
      client.safePlaceOrder({ clientId: "client-1", productKey: fixtureProductKey }),
      /unexpected shape/,
    );
  });

  it("rejects malformed GET /services responses during pre-check", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ not: "an-array" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const client = clientFor(creds);

    await assert.rejects(
      client.safePlaceOrder({ clientId: "client-1", productKey: fixtureProductKey }),
      /unexpected shape/,
    );
  });
});

describe("ResellPortalClient.getServiceById", () => {
  const creds = { RESELLPORTAL_API_KEY: "api-key", RESELLPORTAL_API_SECRET: "api-secret" };

  it("rejects malformed GET /services/{id} responses", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ service_id: "svc-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const client = clientFor(creds);

    await assert.rejects(client.getServiceById("svc-1"), /unexpected shape/);
  });
});

describe("credential literal regression", () => {
  it("contains no hardcoded ResellPortal or Stripe credential-shaped literals in updated files", () => {
    const files = [
      { label: "resellportal.client.ts", path: resolve(__dirname, "resellportal.client.ts") },
      {
        label: "resellportal.client.spec.ts",
        path: resolve(__dirname, "resellportal.client.spec.ts"),
      },
    ];
    const hardcodedHeaderSecretPattern = /["']X-API-(Key|Secret)["']\s*:\s*["'][^"']+["']/;
    const stripeSecretPattern = /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/;
    const resellPortalEnvLiteralPattern = /RESELLPORTAL_API_(KEY|SECRET)\s*=\s*[^\s]+/;

    for (const file of files) {
      const contents = readFileSync(file.path, "utf8");

      assert.equal(
        hardcodedHeaderSecretPattern.test(contents),
        false,
        `Found hardcoded X-API-* credential in ${file.label}`,
      );
      assert.equal(
        stripeSecretPattern.test(contents),
        false,
        `Found Stripe credential-shaped literal in ${file.label}`,
      );
      assert.equal(
        resellPortalEnvLiteralPattern.test(contents),
        false,
        `Found ResellPortal env credential assignment in ${file.label}`,
      );
    }
  });
});
