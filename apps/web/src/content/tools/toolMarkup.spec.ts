import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalogComponent = readFileSync(
  new URL("../../components/marketing/GCHToolsCatalogPage.astro", import.meta.url),
  "utf8",
);
const detailComponent = readFileSync(
  new URL("../../components/marketing/GCHToolDetailPage.astro", import.meta.url),
  "utf8",
);
const teaserComponent = readFileSync(
  new URL("../../components/marketing/GCHToolsTeaser.astro", import.meta.url),
  "utf8",
);

test("tools catalog uses semantic landmarks and labeled category navigation", () => {
  assert.match(catalogComponent, /<main class="gch-tools-page">/);
  assert.match(catalogComponent, /aria-label="Tools catalog categories"/);
  assert.match(catalogComponent, /<article class="gch-tool-card">/);
});

test("tool detail view exposes semantic sections and labeled status metadata", () => {
  assert.match(detailComponent, /<main class="gch-tool-detail">/);
  assert.match(detailComponent, /aria-label="Product detail status"/);
  assert.match(detailComponent, /<section aria-labelledby="tool-features-title">/);
  assert.match(detailComponent, /<section aria-labelledby="tool-pricing-title">/);
  assert.match(detailComponent, /<section aria-labelledby="tool-faq-title">/);
});

test("tools teaser links visitors to the full catalog route", () => {
  assert.match(teaserComponent, /href=\{siteRoutes\.tools\}/);
  assert.match(teaserComponent, /Explore the full Tools catalog/);
});
