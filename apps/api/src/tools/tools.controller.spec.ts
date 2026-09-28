import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { ToolsController } from "./tools.controller";
import { publicToolSchema, publicToolsResponseSchema } from "./tools.catalog";
import { ToolsService } from "./tools.service";

describe("TOOLS v1 public read-only API", () => {
  const service = new ToolsService();
  const controller = new ToolsController(service);

  it("returns only the validated GCH-owned public projection", () => {
    const result = controller.list();
    assert.equal(result.items.length, 18);
    assert.equal(publicToolsResponseSchema.safeParse(result).success, true);

    for (const item of result.items) {
      assert.equal(publicToolSchema.safeParse(item).success, true);
      assert.equal(item.purchase.enabled, false);
      assert.equal(item.pricing.state, "missing");
      assert.equal(item.availability.state, "unknown");
      assert.equal("upstreamProductId" in item, false);
      assert.equal("upstreamProductKey" in item, false);
      assert.equal("storefrontPath" in item, false);
    }
  });

  it("returns one safe projection by valid slug", () => {
    const result = controller.detail({ slug: "web-hosting" });
    assert.equal(result.item.slug, "web-hosting");
    assert.equal(result.item.purchase.enabled, false);
  });

  it("returns 404 for an unknown but syntactically valid slug", () => {
    assert.throws(
      () => controller.detail({ slug: "not-a-real-tool" }),
      NotFoundException,
    );
  });
});
