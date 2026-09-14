/**
 * GCH brand tokens — the single source of truth for color, type, and
 * gradient values across every app in the monorepo.
 *
 * This file existing in machine-readable form (rather than only in Figma)
 * is the direct prerequisite for the Agent Plan's "enforce brand
 * consistency" capability: an agent can only self-check its own output
 * against these values if they're importable, not just visually implied.
 */

export const colors = {
  cloudlight: "#F6F2E7", // base / background
  emberCore: "#A83E1B", // primary brand / CTA
  emberGold: "#E0A537", // accent / highlight
  hearthInk: "#2C231C", // primary text
  ashStone: "#C9C0AF", // secondary / muted surfaces
  verdigrisSky: "#3E6E64", // secondary accent / contrast
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  display: ["Fraunces", "serif"],
  body: ["Inter", "sans-serif"],
  mono: ["JetBrains Mono", "monospace"],
} as const;

export const gradients = {
  sacredEmber: `linear-gradient(135deg, ${colors.emberCore} 0%, ${colors.emberGold} 100%)`,
  midnightVeil: `linear-gradient(135deg, ${colors.hearthInk} 0%, ${colors.verdigrisSky} 100%)`,
} as const;

/**
 * Known-good contrast pairs from the WCAG audit referenced in the
 * architecture doc. Re-run a real contrast check whenever a new component
 * pairs ashStone or emberGold against cloudlight — light-on-light and
 * mid-tone-on-light are where this palette's contrast failures cluster.
 */
export const contrastSafePairs: Array<[ColorToken, ColorToken]> = [
  ["hearthInk", "cloudlight"],
  ["cloudlight", "emberCore"],
  ["cloudlight", "hearthInk"],
  ["cloudlight", "verdigrisSky"],
];

export const pillars = [
  { key: "hosting", label: "Hosting" },
  { key: "ai-tools", label: "AI Tools" },
  { key: "design-marketing", label: "Design & Marketing" },
  { key: "ministry-education", label: "Ministry & Education" },
] as const;

export type PillarKey = (typeof pillars)[number]["key"];
