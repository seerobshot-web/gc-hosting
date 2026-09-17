/**
 * GCH brand tokens — the single source of truth for color, type, and
 * gradient values across every app in the monorepo.
 *
 * This file existing in machine-readable form (rather than only in Figma)
 * is the direct prerequisite for the Agent Plan's "enforce brand
 * consistency" capability: an agent can only self-check its own output
 * against these values if they're importable, not just visually implied.
 *
 * Palette: "Sacred Ember" — Kingdom Balanced. Light Cream surfaces for the
 * portal and marketing; dark Night surfaces for product/dark sections.
 * Gold carries Glory Cloud Hosts, Ministry Blue carries GLinks.
 * Mirror of ../tailwind-preset.js — keep the two in sync.
 */

export const colors = {
  // Light surfaces
  cream: "#F8F5EF",
  creamDim: "#EDE9E2",
  white: "#FFFFFF",
  whiteRaised: "#FAFAF8",
  // Text on light
  ink: "#1A1C26",
  inkSub: "#4A4E66",
  inkMuted: "#8A8FA8",
  // Dark surfaces
  brand: "#0B0D12",
  night: "#1E2028",
  nightDeep: "#15171E",
  nightBase: "#24273A",
  nightElevated: "#2E3347",
  // Text on dark
  onDark: "#FFFFFF",
  onDarkSub: "#C8CCDA",
  onDarkMuted: "#8A90A8",
  onDarkEyebrow: "#C4A06A",
  // Accents
  gold: "#D4900C", // fills on light surfaces — pair with `brand` text
  goldDark: "#E8A020", // fills/text on dark surfaces
  goldText: "#9A6708", // the only gold that passes AA as text on white
  ministry: "#4872B8", // GLinks — passes AA as text on cream/white
  ministryHover: "#3A5C96",
  ministry300: "#93B4DF", // Ministry Blue for dark-mode body copy
  // Sacred Ember stops (commercial) — doubles as the category accent set
  emberCoral: "#E8566A",
  emberOrange: "#F0862E",
  emberGold: "#E8A020",
  // Feedback
  success: "#16A34A",
  successDark: "#22C55E",
  warning: "#D97706",
  danger: "#DC2626",
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  display: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
  body: ["Outfit", "system-ui", "sans-serif"],
  mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
  numeric: ["Space Mono", "ui-monospace", "monospace"],
} as const;

export const gradients = {
  /** Commercial Sacred Ember — the only gradient allowed as UI fill. */
  sacredEmber: `linear-gradient(135deg, ${colors.emberCoral} 0%, ${colors.emberOrange} 50%, ${colors.emberGold} 100%)`,
  /** Raw sunburst — the mark only, never a UI surface. */
  sacredEmberRaw: "linear-gradient(135deg, #FF2D6E 0%, #FF7A1A 50%, #FFD23F 100%)",
  midnightVeil:
    "radial-gradient(ellipse at top right, rgba(207,58,20,0.15) 0%, transparent 55%), linear-gradient(145deg, #202024 0%, #1C1916 42%, #151308 70%, #0B0705 100%)",
} as const;

/**
 * Known-good contrast pairs from the WCAG 2.1 AA audit. Gold #D4900C on
 * white is 2.7:1 — it is a fill color, never body text; use goldText.
 * Ministry Blue on cream/white is 4.8:1 and safe as text at any size.
 */
export const contrastSafePairs: Array<[ColorToken, ColorToken]> = [
  ["ink", "cream"],
  ["ink", "white"],
  ["goldText", "white"],
  ["goldText", "cream"],
  ["ministry", "white"],
  ["ministry", "cream"],
  ["brand", "gold"],
  ["goldDark", "brand"],
  ["onDark", "night"],
];

export const pillars = [
  { key: "hosting", label: "Hosting" },
  { key: "ai-tools", label: "AI Tools" },
  { key: "design-marketing", label: "Design & Marketing" },
  { key: "ministry-education", label: "Ministry & Education" },
] as const;

export type PillarKey = (typeof pillars)[number]["key"];
