import type { ToolEditorialRecord } from "./toolTypes";

export const toolEditorialRecords = [
  {
    slug: "business-website",
    displayName: "Business Website",
    category: "websites-hosting",
    audience: "Organizations that need a guided public website launch or rebuild.",
    teaser: "A GCH-guided website engagement for presenting your organization clearly online.",
    summary:
      "Business Website is positioned as a done-with-you or done-for-you website path inside the broader GCH relationship. Public copy stays outcome-focused and avoids promising exact deliverables until the storefront contract is verified.",
    features: [
      "Outcome-focused positioning for a public-facing business or ministry website",
      "A connected path into hosting, domains, and supporting digital tools",
      "Editorial planning that fits the existing GCH customer journey",
    ],
    prerequisites: [
      "Expect to provide a launch brief and core organization information before build work starts.",
      "Approved copy, branding, and media still need to come from the customer or an approved GCH process.",
    ],
    limitations: [
      "Public pricing, package scope, and storefront identifiers remain unverified.",
      "Ordering stays disabled until the catalog contract confirms the sellable product mapping.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "ai-website-builder",
    displayName: "AI Website Builder",
    category: "websites-hosting",
    audience: "Teams that want a faster way to turn an idea or brief into website direction.",
    teaser: "Prompt-led website planning and page-starting guidance inside the GCH ecosystem.",
    summary:
      "AI Website Builder is presented as a guided starting point for shaping website structure and messaging. The page avoids claiming exact model behavior, pricing, or automation depth that is not verified in repository artifacts.",
    features: [
      "Supports quicker early-stage website planning",
      "Fits the existing GCH website-builder blueprint direction",
      "Can be paired with human review before publication or launch",
    ],
    prerequisites: [
      "Bring a clear goal, audience, and basic content direction for the best starting point.",
      "Expect to review and refine outputs before anything goes live.",
    ],
    limitations: [
      "Public plan limits, included generations, and checkout mapping are not yet verified.",
      "No self-serve purchase path is enabled in Phase 1.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "web-hosting",
    displayName: "Web Hosting",
    category: "websites-hosting",
    audience: "Customers who need managed hosting that stays connected to website and domain work.",
    teaser: "Managed hosting positioned as part of a connected GCH operating system.",
    summary:
      "Web Hosting is described as the infrastructure layer that supports the public site experience. The public card avoids claiming exact resource allocations, billing intervals, or provisioning SLAs until the authoritative catalog is confirmed.",
    features: [
      "Connects hosting decisions with domains, DNS, and website delivery",
      "Presented as part of the broader GCH service relationship",
      "Can support migrations and follow-on site operations planning",
    ],
    prerequisites: [
      "Migration timing, DNS coordination, and current-provider details still need confirmation during onboarding.",
    ],
    limitations: [
      "No public package matrix or price is exposed without verified catalog data.",
      "Provisioning and billing authority remain upstream and are not inferred from the marketing site.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "web-builder",
    displayName: "Web Builder",
    category: "websites-hosting",
    audience: "Agencies and operators who want a builder workflow under GCH branding.",
    teaser: "A branded website-building surface for teams managing repeated website creation work.",
    summary:
      "Web Builder is framed as a white-label or branded website creation capability. The detail page keeps the promise to the outcome and avoids naming unverified limits, editors, or included service levels.",
    features: [
      "Supports repeated website creation under the GCH umbrella",
      "Fits teams that want a simpler operational surface than hand-building every page",
      "Can sit alongside hosting and domain workflows",
    ],
    prerequisites: [
      "Expect branding, workflow, and customer-handoff decisions to be confirmed during setup.",
    ],
    limitations: [
      "No verified public product key, storefront destination, or entitlement matrix is available yet.",
    ],
  },
  {
    slug: "domain-registration",
    displayName: "Domain Registration",
    category: "websites-hosting",
    audience: "Customers securing a new domain or coordinating website and hosting changes.",
    teaser: "Domain coordination presented as part of the larger GCH website and hosting journey.",
    summary:
      "Domain Registration is treated as a connected catalog item rather than a standalone promise. The page avoids exposing guessed search results, TLD pricing, or renewal rules.",
    features: [
      "Supports domain planning alongside website and hosting work",
      "Keeps registration discussions tied to launch and migration decisions",
      "Respects that live availability has to come from the upstream contract",
    ],
    prerequisites: [
      "Live domain availability must be checked against a verified catalog or search contract before purchase.",
    ],
    limitations: [
      "No sample pricing, TLD list, or search widget is published in Phase 1.",
      "Ordering remains disabled until the verified storefront flow is available.",
    ],
  },
  {
    slug: "plugin-theme-white-label",
    displayName: "Plugin and Theme White Label",
    category: "websites-hosting",
    audience: "Agencies that want branded WordPress plugin and theme distribution support.",
    teaser: "A branded plugin-and-theme distribution offering for agencies and repeated delivery workflows.",
    summary:
      "Plugin and Theme White Label is positioned as an agency-support tool rather than a guaranteed feature bundle. The detail page focuses on ownership and setup expectations instead of undocumented capabilities.",
    features: [
      "Supports branded distribution workflows for agencies or managed site operators",
      "Fits customers who want WordPress tooling to look and feel aligned with their brand",
      "Keeps the public story aligned with the existing GCH tooling direction",
    ],
    prerequisites: [
      "Expect to provide a reachable logo URL and domain information during setup.",
      "Any WordPress-specific compatibility or packaging details still require verified product documentation.",
    ],
    limitations: [
      "No public storefront destination or feature matrix is verified yet.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "managed-seo",
    displayName: "Managed SEO",
    category: "marketing-growth",
    audience: "Organizations that want guided search visibility work rather than disconnected tasks.",
    teaser: "Ongoing SEO work positioned around visibility, content structure, and practical next steps.",
    summary:
      "Managed SEO is presented as a guided visibility service inside the connected GCH system. The page avoids promising rankings, deliverable counts, or reporting schedules that are not verified in repository artifacts.",
    features: [
      "Keeps SEO work connected to website structure and content decisions",
      "Supports organizations that want guided help instead of isolated audits",
      "Fits broader growth planning across marketing and web surfaces",
    ],
    prerequisites: [
      "Expect to complete an SEO brief before work begins.",
      "Existing website access and business information may be required during onboarding.",
    ],
    limitations: [
      "Public package scope, cadence, and pricing remain unverified.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "social-media-automation",
    displayName: "Social Media Automation",
    category: "marketing-growth",
    audience: "Teams that want repeatable social publishing support with human oversight.",
    teaser: "A social workflow layer for planning and automating repeatable publishing steps.",
    summary:
      "Social Media Automation is described as an operations helper for recurring publishing tasks. The public page avoids naming unsupported platforms or automation depth beyond the repository-backed prerequisites.",
    features: [
      "Supports repeatable publishing workflows",
      "Fits organizations coordinating content across several social channels",
      "Can sit alongside broader marketing support from GCH",
    ],
    prerequisites: [
      "Connected social accounts are required before any automation can run.",
      "Platform-specific account requirements still apply and must be verified during onboarding.",
    ],
    limitations: [
      "No public platform matrix, posting limits, or billing claims are exposed yet.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "social-media-marketing",
    displayName: "Social Media Marketing",
    category: "marketing-growth",
    audience: "Customers who want managed social growth support tied to campaign goals.",
    teaser: "Managed social marketing support positioned around campaigns, visibility, and practical outcomes.",
    summary:
      "Social Media Marketing stays framed as a service relationship, not a guaranteed package of spend, impressions, or deliverables. The page intentionally avoids unsupported billing and fulfillment details.",
    features: [
      "Supports campaign-oriented social growth work",
      "Fits customers who want strategy and execution support together",
      "Can be paired with SEO, website, and local-visibility work",
    ],
    prerequisites: [
      "Profile validation and service selection still need to be confirmed before activation.",
    ],
    limitations: [
      "No verified quantity, turnaround, pricing, or platform scope is published in Phase 1.",
    ],
  },
  {
    slug: "reputation-review-management",
    displayName: "Reputation and Review Management",
    category: "marketing-growth",
    audience: "Organizations that need more consistent review visibility and response workflows.",
    teaser: "A reputation layer focused on reviews, visibility, and operational follow-through.",
    summary:
      "Reputation and Review Management is described cautiously around visibility and workflow support. The detail page avoids unsupported claims about integrations, reporting depth, or platform reach.",
    features: [
      "Supports review and reputation follow-through as part of broader growth work",
      "Fits teams that need more consistent attention on public feedback loops",
      "Can align with local-search and website improvements",
    ],
    prerequisites: [
      "Any platform connections or API verification steps must be confirmed during onboarding.",
    ],
    limitations: [
      "No public platform list, reporting cadence, or pricing is verified yet.",
    ],
  },
  {
    slug: "link-in-bio",
    displayName: "Link in Bio",
    category: "marketing-growth",
    audience: "Creators, ministries, and businesses that need a simpler mobile-first destination.",
    teaser: "A compact mobile-first destination for key links, campaigns, and next steps.",
    summary:
      "Link in Bio is presented as a lightweight landing surface that supports focused traffic flows. The page stays away from undocumented template counts, analytics features, or monetization claims.",
    features: [
      "Supports a cleaner mobile-first path to important destinations",
      "Fits campaigns, profiles, and short-form audience journeys",
      "Can reinforce larger website and marketing systems",
    ],
    prerequisites: [
      "Approved destinations and campaign priorities should be identified before setup.",
    ],
    limitations: [
      "No verified public catalog identifier or checkout path is available in repository artifacts.",
    ],
  },
  {
    slug: "business-phone",
    displayName: "Business Phone",
    category: "business-operations",
    audience: "Teams that need a managed calling presence connected to business operations.",
    teaser: "Business calling and number-management workflows under the broader GCH relationship.",
    summary:
      "Business Phone is described around outcome and coordination rather than exact telecom features. The public page intentionally avoids promising number inventories, jurisdictions, or billing models that are not verified.",
    features: [
      "Supports business calling workflows that need a clearer operating surface",
      "Fits organizations that want communication tooling connected to other digital systems",
      "Can be reviewed alongside broader operations planning",
    ],
    prerequisites: [
      "Country and number availability must be verified against the upstream product contract before ordering.",
    ],
    limitations: [
      "No public number inventory, porting promise, or plan pricing is exposed.",
    ],
  },
  {
    slug: "appointment-booking",
    displayName: "Appointment Booking",
    category: "business-operations",
    audience: "Organizations scheduling consultations, services, or meetings with multiple constraints.",
    teaser: "Scheduling support for teams that need a more reliable booking workflow.",
    summary:
      "Appointment Booking is presented as an operations tool for managing availability and customer scheduling. The page keeps implementation details narrow to the prerequisites actually supported in the problem statement.",
    features: [
      "Supports scheduling as part of a connected customer journey",
      "Fits teams coordinating staff, services, or location-based booking flows",
      "Can reduce friction before consultation or delivery work begins",
    ],
    prerequisites: [
      "Timezone, schedule, services, staff, and location configuration need to be prepared during setup.",
    ],
    limitations: [
      "No public storefront path, integration matrix, or pricing has been verified.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "document-signing-platform",
    displayName: "Document Signing Platform",
    category: "business-operations",
    audience: "Teams that need a managed document-signing workflow without exposing unverified claims.",
    teaser: "A document-signing workflow for agreements, approvals, and operational follow-through.",
    summary:
      "Document Signing Platform is described around the need for guided signing workflows. The detail page avoids unsupported claims about legal posture, integrations, or retention policies.",
    features: [
      "Supports digital signing and approval workflows",
      "Fits customers that need a more structured document handoff process",
      "Can be paired with booking and operations tooling",
    ],
    prerequisites: [
      "Document-format and upload-size constraints must be reviewed during onboarding.",
    ],
    limitations: [
      "No verified transaction limits, legal statements, or public pricing are published here.",
    ],
    homepageFeatured: true,
  },
  {
    slug: "windows-vpn",
    displayName: "Windows VPN",
    category: "business-operations",
    audience: "Customers who need a privacy or connectivity tool for Windows-based workflows.",
    teaser: "A Windows-focused VPN offer presented cautiously until the catalog contract is verified.",
    summary:
      "Windows VPN is positioned as a utility for privacy or remote-connectivity workflows. The page avoids promising regions, throughput, logging posture, or device counts that are not verified in repository artifacts.",
    features: [
      "Supports Windows-based privacy and connectivity workflows",
      "Fits customers who need a simpler path into managed utility tooling",
      "Keeps the public presentation aligned with Phase 1 read-only rules",
    ],
    prerequisites: [
      "A supported Windows client and valid credentials are required before use.",
    ],
    limitations: [
      "No public server list, plan matrix, or installer destination is exposed in Phase 1.",
    ],
  },
  {
    slug: "esim-packages",
    displayName: "eSIM Packages",
    category: "business-operations",
    audience: "Traveling teams and operators who need mobile connectivity options through GCH.",
    teaser: "eSIM connectivity packages presented without invented region, plan, or pricing details.",
    summary:
      "eSIM Packages are described as a connectivity offer rather than a published tariff table. The page avoids unsupported claims about supported countries, data caps, and activation flows.",
    features: [
      "Supports connectivity planning for mobile-first or travel-heavy work",
      "Fits teams that want a GCH-guided entry point instead of separate vendor research",
      "Can be reviewed alongside other operations tooling",
    ],
    prerequisites: [
      "Actual package data, supported devices, and activation rules must be confirmed against the catalog contract before ordering.",
    ],
    limitations: [
      "No region list, plan sizes, or pricing is published without verified source data.",
    ],
  },
  {
    slug: "cpanel-email-file-management",
    displayName: "cPanel Email and File Management",
    category: "business-operations",
    audience: "Customers who need practical access to email and file-management tasks in a hosting workflow.",
    teaser: "Operational access to cPanel-oriented email and file-management workflows.",
    summary:
      "cPanel Email and File Management is framed as a practical capability customers may need in a hosting relationship. The page avoids implying a standalone SKU or claiming exact mailbox or storage features without verified catalog evidence.",
    features: [
      "Supports practical hosting-adjacent email and file tasks",
      "Fits customers who need a guided operations surface rather than raw infrastructure alone",
      "Can be discussed alongside hosting and migration work",
    ],
    prerequisites: [
      "Specific mailbox, file-access, and entitlement details still need confirmation during onboarding.",
    ],
    limitations: [
      "The repository does not verify whether this capability is currently sold as a standalone catalog item.",
    ],
  },
  {
    slug: "private-ai-box",
    displayName: "Private AI Box",
    category: "infrastructure-advanced",
    audience: "Organizations exploring more private AI workflows with a guided qualification step.",
    teaser: "A private AI environment concept for sensitive or internally controlled workflows.",
    summary:
      "Private AI Box is positioned as a higher-consideration infrastructure offer that needs qualification before any commercial step. The public page intentionally prefers contact-led next steps over storefront assumptions.",
    features: [
      "Supports a more private AI operating model than generic public tools",
      "Fits customers with internal-process, privacy, or control requirements",
      "Can be discussed as part of broader infrastructure planning",
    ],
    prerequisites: [
      "Qualification is required to confirm fit, environment, and operating expectations.",
    ],
    limitations: [
      "No self-serve ordering, pricing, or deployment promise is exposed in Phase 1.",
    ],
  },
] as const satisfies readonly ToolEditorialRecord[];
