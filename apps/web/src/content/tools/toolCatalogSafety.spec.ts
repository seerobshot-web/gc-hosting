import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toolCatalog } from "./toolCatalog";
import { primaryNavItems, siteRoutes } from "../../config/site-routes";

const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]+/, /sk_test_[a-zA-Z0-9]+/, /pk_live_[a-zA-Z0-9]+/,
  /whsec_[a-zA-Z0-9]+/, /AKIA[0-9A-Z]{16}/, /Bearer [A-Za-z0-9._-]{10,}/,
  /RESELLPORTAL_API_(KEY|SECRET)\s*=\s*['"][^'"]+['"]/,
];

const CATALOG_SOURCE_FILES = [
  "toolCatalog.ts", "toolEditorial.ts", "toolMappings.ts", "toolPurchaseGate.ts", "toolTypes.ts",
].map((name) => readFileSync(new URL(name, import.meta.url), "utf8"));

const COMPONENT_FILES = [
  "../../components/marketing/GCHToolsCatalogPage.astro",
  "../../components/marketing/GCHToolDetailPage.astro",
  "../../components/marketing/GCHToolsTeaser.astro",
].map((rel) => readFileSync(new URL(rel, import.meta.url), "utf8"));

test("no secret-shaped value appears in the serialized catalog or its source", () => {
  const serialized = JSON.stringify(toolCatalog);
  for (const pattern of SECRET_PATTERNS) {
    assert.doesNotMatch(serialized, pattern);
  }
  for (const source of [...CATALOG_SOURCE_FILES, ...COMPONENT_FILES]) {
    for (const pattern of SECRET_PATTERNS) {
      assert.doesNotMatch(source, pattern);
    }
    // No process.env read anywhere in the catalog/component chain — this
    // data is fully static, and reading env at build time would risk
    // leaking a server-only value into the static bundle.
    assert.doesNotMatch(source, /process\.env/);
  }
});

test("no provider call, fetch, or HTTP client is reachable from the static catalog build", () => {
  for (const source of CATALOG_SOURCE_FILES) {
    assert.doesNotMatch(source, /\bfetch\(/);
    assert.doesNotMatch(source, /ResellPortal.*Adapter/);
    assert.doesNotMatch(source, /axios|node-fetch|undici/);
  }
});

test("the homepage Tools journey and primary navigation are unchanged", () => {
  const homepage = readFileSync(new URL("../../pages/index.astro", import.meta.url), "utf8");
  assert.match(homepage, /GCHToolsTeaser/);

  const nav = readFileSync(
    new URL("../../components/marketing/GCHPrimaryNav.astro", import.meta.url), "utf8",
  );
  assert.match(nav, /primaryNavItems/);
  assert.ok(primaryNavItems.some((item) => item.label === "Tools" && item.href === siteRoutes.tools));
});

test("shared interaction layer 02 and 03 keeps the locked navigation and audience contracts", () => {
  const homepage = readFileSync(new URL("../../pages/index.astro", import.meta.url), "utf8");
  const nav = readFileSync(
    new URL("../../components/marketing/GCHPrimaryNav.astro", import.meta.url), "utf8",
  );
  const audience = readFileSync(
    new URL("../../components/marketing/GCHAudienceSwitcher.astro", import.meta.url), "utf8",
  );
  const audienceData = readFileSync(
    new URL("../../components/marketing/audienceData.ts", import.meta.url), "utf8",
  );

  assert.deepEqual(
    primaryNavItems.map(({ index, label, href }) => ({ index, label, href })),
    [
      { index: "01", label: "Marketing", href: siteRoutes.marketing },
      { index: "02", label: "Ministry", href: siteRoutes.ministry },
      { index: "03", label: "Hosting", href: siteRoutes.hosting },
      { index: "04", label: "Tools", href: siteRoutes.tools },
      { index: "05", label: "Deals", href: siteRoutes.deals },
      { index: "06", label: "Resources", href: siteRoutes.resources },
    ],
  );

  assert.match(nav, /data-gch-nav-surface="light"/);
  assert.match(nav, /data-gch-nav-surface = surface === "dark" \? "dark" : "light"/);
  assert.match(nav, /<details class="gch-nav__mobile">/);
  assert.match(nav, />Portal<\/a>/);
  assert.match(nav, />Get started<\/a>/);
  assert.doesNotMatch(nav, />Search<\/a>|>Search<\/button>/);
  assert.match(nav, /prefers-reduced-motion/);

  assert.match(homepage, /GCHAudienceSwitcher/);
  assert.match(audience, /role="tablist"/);
  assert.match(audience, /role="tabpanel"/);
  assert.match(audience, /ArrowRight/);
  assert.match(audience, /ArrowLeft/);
  assert.match(audience, /scroll-snap-type: x proximity/);
  assert.match(audience, /prefers-reduced-motion/);

  for (const label of ["Church", "Ministry", "Nonprofit", "Coach", "Creator", "Christian Business"]) {
    assert.match(audienceData, new RegExp(`label: "${label}"`));
  }
});
