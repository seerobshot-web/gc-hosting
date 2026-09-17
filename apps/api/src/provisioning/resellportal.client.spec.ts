import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
