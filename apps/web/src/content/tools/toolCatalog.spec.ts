import assert from "node:assert/strict";
import test from "node:test";
import {
  getHomepageToolTeasers,
  getToolBySlug,
  getToolsByCategory,
  toolCatalog,
} from "./toolCatalog";
import { toolEditorialRecords } from "./toolEditorial";
import { toolMappings } from "./toolMappings";

const approvedSlugs = [
  "business-website",
  "ai-website-builder",
  "web-hosting",
  "web-builder",
  "domain-registration",
  "plugin-theme-white-label",
  "managed-seo",
  "social-media-automation",
  "social-media-marketing",
  "reputation-reviews",
  "link-in-bio",
  "business-phone",
  "appointment-booking",
  "document-signing",
  "windows-vpn",
  "esim-packages",
  "cpanel-email-files",
  "private-ai-box",
] as const;

test("tool editorial records cover all 18 approved products with unique slugs", () => {
  assert.equal(toolEditorialRecords.length, 18);
  assert.equal(new Set(toolEditorialRecords.map((record) => record.slug)).size, 18);
  assert.deepEqual(
    toolEditorialRecords.map((record) => record.slug).sort(),
    [...approvedSlugs].sort(),
  );
});

test("every editorial record has an explicit mapping and ordering stays disabled", () => {
  assert.equal(toolMappings.length, toolEditorialRecords.length);
  assert.deepEqual(
    toolMappings.map((mapping) => mapping.slug).sort(),
    toolEditorialRecords.map((record) => record.slug).sort(),
  );
  assert.ok(toolMappings.every((mapping) => mapping.orderEnabled === false));
});

test("homepage teaser returns eight allowlisted tools", () => {
  const teasers = getHomepageToolTeasers();
  assert.equal(teasers.length, 8);
  assert.ok(teasers.every((tool) => toolCatalog.some((candidate) => candidate.slug === tool.slug)));
});

test("unknown slugs do not produce public tool pages", () => {
  assert.equal(getToolBySlug("not-a-real-tool"), undefined);
});

test("catalog groups tools into the four required outcome categories", () => {
  const groups = getToolsByCategory();
  assert.equal(groups.length, 4);
  assert.ok(groups.every((group) => group.tools.length > 0));
});

test("catalog placeholders never expose guessed prices or enabled order links", () => {
  assert.ok(
    toolCatalog.every(
      (tool) =>
        tool.pricing.state !== "verified" &&
        tool.availability.value === "Contact us" &&
        tool.mapping.orderEnabled === false,
    ),
  );
});
