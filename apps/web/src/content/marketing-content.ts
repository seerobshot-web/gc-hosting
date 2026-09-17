export type ContentSourceStatus = "approved" | "repo-verified" | "catalog-required" | "draft-brief";

export interface ContentSource {
  id: string;
  label: string;
  status: ContentSourceStatus;
  repositoryPath?: string;
  notes: string;
}

export const contentSources: Record<string, ContentSource> = {
  positioning: {
    id: "positioning",
    label: "Approved GCH positioning",
    status: "approved",
    notes: "Approved public positioning for GCH: one connected provider for identity, digital presence, infrastructure, reach, and modern digital tools.",
  },
  journeyMatrix: {
    id: "journey-matrix",
    label: "Public Marketing 35-Journey Matrix",
    status: "repo-verified",
    repositoryPath: "docs/marketing/PUBLIC-MARKETING-WIREFRAME-MATRIX.md",
    notes: "Authoritative interaction, visual-family, accessibility, and journey architecture baseline for the public marketing site.",
  },
  websiteBuilderBlueprint: {
    id: "website-builder-blueprint",
    label: "Website Builder Delivery Blueprint",
    status: "repo-verified",
    repositoryPath: "blueprints/website-builder/README.md",
    notes: "Supports the existence of AI Builder delivery workflow and the SEED / FRUIT / HARVEST / LABORER tier names. It does not establish public pricing or full entitlement matrices.",
  },
  canonicalCatalog: {
    id: "canonical-catalog",
    label: "GCH canonical product catalog",
    status: "catalog-required",
    notes: "Required source for sellable products, package membership, plan limits, pricing, billing periods, and contractual entitlements. Public UI must not invent these values.",
  },
  resourceEditorial: {
    id: "resource-editorial",
    label: "Public resource editorial queue",
    status: "draft-brief",
    notes: "Resource titles can exist as editorial briefs, but publication dates, URLs, read times, and article claims must be supplied by approved published content.",
  },
};

export const publicCategoryContent = {
  marketing: {
    eyebrow: "Marketing",
    title: "Build a presence people can understand and trust.",
    body: "GCH connects brand identity, websites, local visibility, search, and growth work so organizations do not have to coordinate disconnected providers.",
    source: "positioning",
  },
  ministry: {
    eyebrow: "Ministry",
    title: "Connect what happens in the room to the people beyond it.",
    body: "Websites, GLinks, streaming pathways, hosting, and ministry-focused tools can work as one connected digital journey.",
    source: "positioning",
  },
  hosting: {
    eyebrow: "Hosting",
    title: "Infrastructure that stays connected to the work above it.",
    body: "GCH treats domains, DNS, hosting, migrations, websites, and service mapping as a connected system rather than an isolated hosting purchase.",
    source: "journeyMatrix",
  },
  tools: {
    eyebrow: "Tools",
    title: "Purpose-built digital tools inside the same GCH relationship.",
    body: "The current product direction includes AI Website Builder experiences, GLinks, WordPress tooling, and Private AI concepts. Availability and commercial terms must come from the canonical catalog before launch.",
    source: "canonicalCatalog",
  },
} as const;

export const planTierNames = ["SEED", "FRUIT", "HARVEST", "LABORER"] as const;

export const resourceBriefs = [
  {
    id: "ministry-website-planning",
    type: "FIELD GUIDE",
    title: "Planning a ministry website that supports Sunday and weekday engagement",
    status: "draft-brief",
    source: "resourceEditorial",
  },
  {
    id: "redesign-readiness",
    type: "CHECKLIST",
    title: "Website redesign readiness: what to gather before the rebuild",
    status: "draft-brief",
    source: "resourceEditorial",
  },
  {
    id: "local-search-system",
    type: "SEO GUIDE",
    title: "How local search, Google Business, and service pages reinforce each other",
    status: "draft-brief",
    source: "resourceEditorial",
  },
  {
    id: "ministry-tech-stack",
    type: "MINISTRY TECH",
    title: "Connecting livestreams, GLinks, events, giving, and next steps",
    status: "draft-brief",
    source: "resourceEditorial",
  },
] as const;
