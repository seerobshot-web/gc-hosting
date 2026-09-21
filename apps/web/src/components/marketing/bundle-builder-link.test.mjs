import assert from "node:assert/strict";
import test from "node:test";

import { buildBundleStartHref } from "./bundle-builder-link.mjs";

test("buildBundleStartHref keeps the start route relative", () => {
  assert.equal(
    buildBundleStartHref("/start?utm=campaign#contact", ["website", "hosting"]),
    "/start?utm=campaign&capability=website&capability=hosting#contact",
  );
});

test("buildBundleStartHref replaces prior capability params", () => {
  assert.equal(
    buildBundleStartHref("/start?capability=brand&ref=nav", ["seo"]),
    "/start?ref=nav&capability=seo",
  );
});
