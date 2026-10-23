import { siteRoutes, toolDetailRoute } from "../../config/site-routes";
import { toolEditorialRecords } from "./toolEditorial";
import { toolMappings } from "./toolMappings";
import { getToolDemo } from "./toolDemos";
import { resolvePurchaseGate } from "./toolPurchaseGate";
import type {
  ToolCardProjection,
  ToolCategory,
  ToolEditorialRecord,
  ToolMappingRecord,
} from "./toolTypes";

export const toolCategoryMeta: Record<
  ToolCategory,
  { id: string; index: string; title: string; description: string }
> = {
  "websites-hosting": {
    id: "websites-hosting",
    index: "01",
    title: "Websites and hosting",
    description: "Website, hosting, domain, and delivery tools that support a public digital presence.",
  },
  "marketing-growth": {
    id: "marketing-growth",
    index: "02",
    title: "Marketing and growth",
    description: "Visibility, social, reputation, and audience-growth tools presented with safe public disclosures.",
  },
  "business-operations": {
    id: "business-operations",
    index: "03",
    title: "Business operations",
    description: "Operational tools that help teams schedule, communicate, sign, connect, and manage daily workflows.",
  },
  "infrastructure-advanced": {
    id: "infrastructure-advanced",
    index: "04",
    title: "Infrastructure and advanced tools",
    description: "Higher-consideration tools that need qualification before any commercial handoff.",
  },
};

export const toolsLastReviewed = "2026-09-26";
export const toolsSourceLabel = "GCH editorial allowlist · contract-gap guarded";
export const toolsContractStatus =
  "Repository artifacts do not verify a public ResellPortal tools catalog contract, so public ordering stays disabled and live prices are withheld.";

const mappingBySlug = new Map<string, ToolMappingRecord>(toolMappings.map((mapping) => [mapping.slug, mapping]));
const editorialBySlug = new Map<string, ToolEditorialRecord>(
  toolEditorialRecords.map((record) => [record.slug, record]),
);

function createProjection(record: ToolEditorialRecord): ToolCardProjection {
  const mapping = mappingBySlug.get(record.slug);
  if (!mapping) {
    throw new Error(`Missing tool mapping for slug "${record.slug}"`);
  }

  return {
    slug: record.slug,
    displayName: record.displayName,
    category: record.category,
    audience: record.audience,
    teaser: record.teaser,
    summary: record.summary,
    features: record.features,
    prerequisites: record.prerequisites,
    limitations: record.limitations,
    pricing: {
      state: "missing",
      value: "Pricing available after catalog verification",
      note: "No verified public price is exposed until the upstream catalog contract is confirmed.",
    },
    availability: {
      state: "unknown",
      value: "Contact us",
      note: mapping.statusNote,
    },
    mapping,
    purchase: resolvePurchaseGate(mapping),
    demo: getToolDemo(record.slug),
    detailHref: toolDetailRoute(record.slug),
    contactHref: siteRoutes.start,
    sourceLabel: toolsSourceLabel,
    lastReviewed: toolsLastReviewed,
  };
}

export const toolCatalog = toolEditorialRecords.map(createProjection);

export function getToolBySlug(slug: string) {
  const record = editorialBySlug.get(slug);
  return record ? createProjection(record) : undefined;
}

export function getToolsByCategory() {
  return Object.entries(toolCategoryMeta).map(([category, meta]) => ({
    ...meta,
    category: category as ToolCategory,
    tools: toolCatalog.filter((tool) => tool.category === category),
  }));
}

export function getHomepageToolTeasers(limit = 8) {
  return toolCatalog.filter((tool) => editorialBySlug.get(tool.slug)?.homepageFeatured).slice(0, limit);
}

export function getDemoRunwayTools(limit = 6) {
  const priority = ["business-phone", "web-builder", "link-in-bio"];
  const verified = toolCatalog
    .filter((tool) => tool.demo.status === "verified")
    .sort((a, b) => {
      const ai = priority.indexOf(a.slug);
      const bi = priority.indexOf(b.slug);
      return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) -
        (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
    });
  const featured = toolCatalog.filter(
    (tool) =>
      editorialBySlug.get(tool.slug)?.homepageFeatured &&
      !verified.some((verifiedTool) => verifiedTool.slug === tool.slug),
  );
  return [...verified, ...featured].slice(0, limit);
}
