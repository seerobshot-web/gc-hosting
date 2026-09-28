import { z } from "zod";

export const publicToolSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().min(1),
  category: z.enum([
    "websites-hosting",
    "marketing-growth",
    "business-operations",
    "infrastructure-advanced",
  ]),
  audience: z.string().min(1),
  teaser: z.string().min(1),
  pricing: z.object({
    state: z.literal("missing"),
    value: z.literal("Pricing available after catalog verification"),
  }),
  availability: z.object({
    state: z.literal("unknown"),
    value: z.literal("Contact us"),
  }),
  purchase: z.object({
    enabled: z.literal(false),
  }),
});

export const publicToolsResponseSchema = z.object({
  source: z.object({
    authority: z.literal("gch-editorial"),
    upstreamCatalogVerified: z.literal(false),
    lastReviewed: z.string(),
  }),
  items: z.array(publicToolSchema),
});

export type PublicTool = z.infer<typeof publicToolSchema>;

const safeDefaults = {
  pricing: {
    state: "missing" as const,
    value: "Pricing available after catalog verification" as const,
  },
  availability: {
    state: "unknown" as const,
    value: "Contact us" as const,
  },
  purchase: { enabled: false as const },
};

export const publicTools = z.array(publicToolSchema).parse([
  ["business-website", "Business Website", "websites-hosting", "Organizations that need a guided public website launch or rebuild.", "A GCH-guided website engagement for presenting your organization clearly online."],
  ["ai-website-builder", "AI Website Builder", "websites-hosting", "Teams that want a faster way to turn an idea or brief into website direction.", "Prompt-led website planning and page-starting guidance inside the GCH ecosystem."],
  ["web-hosting", "Web Hosting", "websites-hosting", "Customers who need managed hosting that stays connected to website and domain work.", "Managed hosting positioned as part of a connected GCH operating system."],
  ["web-builder", "Web Builder", "websites-hosting", "Agencies and operators who want a builder workflow under GCH branding.", "A branded website-building surface for teams managing repeated website creation work."],
  ["domain-registration", "Domain Registration", "websites-hosting", "Customers securing a new domain or coordinating website and hosting changes.", "Domain coordination presented as part of the larger GCH website and hosting journey."],
  ["plugin-theme-white-label", "Plugin and Theme White Label", "websites-hosting", "Agencies that want branded WordPress plugin and theme distribution support.", "A branded plugin-and-theme distribution offering for agencies and repeated delivery workflows."],
  ["managed-seo", "Managed SEO", "marketing-growth", "Organizations that want guided search visibility work rather than disconnected tasks.", "Ongoing SEO work positioned around visibility, content structure, and practical next steps."],
  ["social-media-automation", "Social Media Automation", "marketing-growth", "Teams that want repeatable social publishing support with human oversight.", "A social workflow layer for planning and automating repeatable publishing steps."],
  ["social-media-marketing", "Social Media Marketing", "marketing-growth", "Customers who want managed social growth support tied to campaign goals.", "Managed social marketing support positioned around campaigns, visibility, and practical outcomes."],
  ["reputation-reviews", "Reputation and Review Management", "marketing-growth", "Organizations that need more consistent review visibility and response workflows.", "A reputation layer focused on reviews, visibility, and operational follow-through."],
  ["link-in-bio", "Link in Bio", "marketing-growth", "Creators, ministries, and businesses that need a simpler mobile-first destination.", "A compact mobile-first destination for key links, campaigns, and next steps."],
  ["business-phone", "Business Phone", "business-operations", "Teams that need a managed calling presence connected to business operations.", "Business calling and number-management workflows under the broader GCH relationship."],
  ["appointment-booking", "Appointment Booking", "business-operations", "Organizations scheduling consultations, services, or meetings with multiple constraints.", "Scheduling support for teams that need a more reliable booking workflow."],
  ["document-signing", "Document Signing Platform", "business-operations", "Teams that need a managed document-signing workflow without exposing unverified claims.", "A document-signing workflow for agreements, approvals, and operational follow-through."],
  ["windows-vpn", "Windows VPN", "business-operations", "Customers who need a privacy or connectivity tool for Windows-based workflows.", "A Windows-focused VPN offer presented cautiously until the catalog contract is verified."],
  ["esim-packages", "eSIM Packages", "business-operations", "Traveling teams and operators who need mobile connectivity options through GCH.", "eSIM connectivity packages presented without invented region, plan, or pricing details."],
  ["cpanel-email-files", "cPanel Email and File Management", "business-operations", "Customers who need practical access to email and file-management tasks in a hosting workflow.", "Operational access to cPanel-oriented email and file-management workflows."],
  ["private-ai-box", "Private AI Box", "infrastructure-advanced", "Organizations exploring more private AI workflows with a guided qualification step.", "A private AI environment concept for sensitive or internally controlled workflows."],
].map(([slug, displayName, category, audience, teaser]) => ({
  slug,
  displayName,
  category,
  audience,
  teaser,
  ...safeDefaults,
})));

export const publicToolsSource = {
  authority: "gch-editorial" as const,
  upstreamCatalogVerified: false as const,
  lastReviewed: "2026-09-28",
};
