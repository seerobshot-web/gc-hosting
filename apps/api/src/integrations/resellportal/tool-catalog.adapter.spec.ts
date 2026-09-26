import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { ResellPortalToolCatalogAdapter } from "./tool-catalog.adapter";

const catalogResponseSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string(),
      name: z.string(),
    }),
  ),
});

function createAdapter(fetchImpl: typeof fetch, timeoutMs = 50) {
  return new ResellPortalToolCatalogAdapter(
    {
      baseUrl: "https://catalog.example.test",
      path: "/catalog",
      timeoutMs,
      requestHeaders: {
        Authorization: "******",
        "X-Api-Key": "super-secret-key",
      },
      responseSchema: catalogResponseSchema,
      normalize: (response) => response.items,
    },
    fetchImpl,
  );
}

describe("ResellPortalToolCatalogAdapter", () => {
  it("returns a contract-gap error when no verified contract config exists", async () => {
    const adapter = new ResellPortalToolCatalogAdapter(null);
    const result = await adapter.fetchCatalog();

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "contract-gap");
  });

  it("loads a validated success fixture through the injected schema", async () => {
    const adapter = createAdapter(async () => {
      return new Response(
        JSON.stringify({
          items: [{ sku: "business-website", name: "Business Website" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await adapter.fetchCatalog();

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.records, [{ sku: "business-website", name: "Business Website" }]);
  });

  it("rejects incomplete or invalid upstream responses", async () => {
    const adapter = createAdapter(async () => {
      return new Response(JSON.stringify({ items: [{ sku: "missing-name" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await adapter.fetchCatalog();

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "invalid-response");
  });

  it("classifies auth failures", async () => {
    const adapter = createAdapter(async () => new Response("denied", { status: 401 }));
    const result = await adapter.fetchCatalog();

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "auth");
  });

  it("classifies rate limits and preserves retry-after", async () => {
    const adapter = createAdapter(
      async () => new Response("slow down", { status: 429, headers: { "retry-after": "15" } }),
    );
    const result = await adapter.fetchCatalog();

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "rate-limit");
    assert.equal(result.error.retryAfterSeconds, 15);
  });

  it("classifies generic upstream failures", async () => {
    const adapter = createAdapter(async () => new Response("boom", { status: 503 }));
    const result = await adapter.fetchCatalog();

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "upstream");
  });

  it("classifies timeouts", async () => {
    const adapter = createAdapter(
      async (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
      5,
    );

    const result = await adapter.fetchCatalog();

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.type, "timeout");
  });

  it("redacts credentials from loggable config", () => {
    const adapter = createAdapter(async () => new Response("[]", { status: 500 }));
    assert.deepEqual(adapter.describeConfigForLogs(), {
      configured: true,
      baseUrl: "https://catalog.example.test",
      path: "/catalog",
      timeoutMs: 50,
      headers: {
        Authorization: "[REDACTED]",
        "X-Api-Key": "[REDACTED]",
      },
    });
  });
});
