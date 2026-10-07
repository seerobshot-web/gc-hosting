/** Owner brief, 2026-10-06. Missing prices are null, never zero. */
export const catalogVersion = "2026-10-06.1";
export interface CatalogAmount {
  cents: number | null;
  verified: boolean;
}
export interface Deal {
  id: string;
  name: string;
  price: CatalogAmount;
  fulfillment: "human" | "resellportal";
  enabled: boolean;
  termMonths: number | null;
  guide: string | null;
  blockers: readonly string[];
  items: readonly string[];
  wholesaleYear: CatalogAmount;
}
export const deals: readonly Deal[] = Object.freeze([
  {
    id: "brand-identity-development",
    name: "Brand Identity Development",
    price: {
      cents: 17500,
      verified: true,
    },
    fulfillment: "human",
    enabled: true,
    termMonths: null,
    guide: "GCH-Brand-Identity-Development.pdf",
    blockers: [],
    items: ["Brand Identity Development"],
    wholesaleYear: {
      cents: 0,
      verified: true,
    },
  },
  {
    id: "seed-standard",
    name: "Seed Standard",
    price: {
      cents: 52350,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Seed-Standard.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: ["Web Hosting (Starter)", "Link in Bio", "AI FAQ Assistant"],
    wholesaleYear: {
      cents: 21000,
      verified: false,
    },
  },
  {
    id: "seed-deluxe",
    name: "Seed Deluxe",
    price: {
      cents: 69850,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Seed-Deluxe.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: [
      "Web Hosting (Starter)",
      "Link in Bio",
      "AI FAQ Assistant",
      "Brand Identity Development",
    ],
    wholesaleYear: {
      cents: 21000,
      verified: false,
    },
  },
  {
    id: "seed-premium",
    name: "Seed Premium",
    price: {
      cents: 117880,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Seed-Premium.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: [
      "Web Hosting (Business)",
      "Link in Bio",
      "AI FAQ Assistant",
      "AI Email Auto-Responder",
      "Cloud Storage (100 GB)",
      "Brand Identity Development",
    ],
    wholesaleYear: {
      cents: 40500,
      verified: false,
    },
  },
  {
    id: "fruit-standard",
    name: "Fruit Standard",
    price: {
      cents: 98800,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Fruit-Standard.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: ["CRM", "AI Lead Capture", "AI Email Auto-Responder"],
    wholesaleYear: {
      cents: 38000,
      verified: false,
    },
  },
  {
    id: "fruit-deluxe",
    name: "Fruit Deluxe",
    price: {
      cents: 139300,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Fruit-Deluxe.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: ["CRM", "AI Lead Capture", "AI Email Auto-Responder", "Appointment Booking"],
    wholesaleYear: {
      cents: 56000,
      verified: false,
    },
  },
  {
    id: "fruit-premium",
    name: "Fruit Premium",
    price: {
      cents: 206900,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Fruit-Premium.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: [
      "CRM",
      "AI Lead Capture",
      "AI Email Auto-Responder",
      "Appointment Booking",
      "Social Media Automation",
      "AI FAQ Assistant",
    ],
    wholesaleYear: {
      cents: 82000,
      verified: false,
    },
  },
  {
    id: "harvest-standard",
    name: "Harvest Standard",
    price: {
      cents: 466360,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Harvest-Standard.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: ["Business Website", "CRM", "AI Email Auto-Responder"],
    wholesaleYear: {
      cents: 203600,
      verified: false,
    },
  },
  {
    id: "harvest-deluxe",
    name: "Harvest Deluxe",
    price: {
      cents: 506860,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Harvest-Deluxe.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: ["Business Website", "CRM", "AI Email Auto-Responder", "Reputation Management"],
    wholesaleYear: {
      cents: 221600,
      verified: false,
    },
  },
  {
    id: "harvest-premium",
    name: "Harvest Premium",
    price: {
      cents: 1109260,
      verified: true,
    },
    fulfillment: "resellportal",
    enabled: false,
    termMonths: 12,
    guide: "GCH-Deal-Harvest-Premium.pdf",
    blockers: [
      "wholesale_prices_unresolved",
      "rp_contract_unresolved",
      "product_price_breakdown_unresolved",
    ],
    items: [
      "Business Website",
      "Managed SEO",
      "CRM",
      "AI Email Auto-Responder",
      "Reputation Management",
      "AI Business Intelligence",
    ],
    wholesaleYear: {
      cents: 485600,
      verified: false,
    },
  },
]);
export function findDeal(id: string): Deal | undefined {
  return deals.find((d) => d.id === id);
}
export function checkoutBlockers(
  deal: Deal | undefined,
  enabled: boolean,
  allowed: readonly string[],
): string[] {
  if (!enabled) return ["commerce_disabled"];
  if (!deal) return ["unknown_deal"];
  const blockers = [...deal.blockers];
  if (!deal.enabled || !allowed.includes(deal.id)) blockers.push("deal_disabled");
  if (
    !deal.price.verified ||
    !Number.isSafeInteger(deal.price.cents) ||
    (deal.price.cents ?? 0) <= 0
  )
    blockers.push("price_unverified");
  if (!deal.guide) blockers.push("guide_unresolved");
  // No approved RP deal contracts exist. An environment switch cannot manufacture one.
  if (deal.fulfillment === "resellportal") blockers.push("rp_contract_unresolved");
  return [...new Set(blockers)];
}
export type CommerceStatus =
  "CREATED" | "PAID" | "PROVISIONING" | "PROVISIONED" | "ACTIVE" | "HELD" | "FAILED";
export function canTransition(from: CommerceStatus, to: CommerceStatus): boolean {
  const transitions: Record<CommerceStatus, readonly CommerceStatus[]> = {
    CREATED: ["PAID", "HELD", "FAILED"],
    PAID: ["PROVISIONING", "HELD"],
    PROVISIONING: ["PROVISIONED", "HELD", "FAILED"],
    PROVISIONED: ["ACTIVE", "HELD"],
    ACTIVE: ["HELD"],
    HELD: [],
    FAILED: [],
  };
  return transitions[from].includes(to);
}
