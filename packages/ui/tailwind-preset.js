/**
 * Hex values are intentionally restated here (not imported from
 * src/tokens.ts) because Tailwind loads this config with plain Node
 * `require`, which can't resolve a .ts file without a loader. This file —
 * not src/tokens.ts — is the canonical source for anything Tailwind-facing;
 * src/tokens.ts is canonical for anything imported directly into TS/TSX.
 * Keep the two in sync if a token value ever changes.
 *
 * Palette: "Sacred Ember" — Kingdom Balanced. Light Cream surfaces for the
 * portal and marketing; dark Night surfaces for product/dark sections.
 * Gold carries Glory Cloud Hosts, Ministry Blue carries GLinks.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: "#F8F5EF", dim: "#EDE9E2" },
        "white-raised": "#FAFAF8",
        ink: { DEFAULT: "#1A1C26", sub: "#4A4E66", muted: "#8A8FA8" },
        brand: "#0B0D12",
        night: { DEFAULT: "#1E2028", deep: "#15171E", base: "#24273A", elevated: "#2E3347" },
        ondark: { DEFAULT: "#FFFFFF", sub: "#C8CCDA", muted: "#8A90A8", eyebrow: "#C4A06A" },
        gold: {
          // DEFAULT is for fills on light surfaces (pair with text-brand).
          // `text` is the only gold that passes AA as body text on white.
          DEFAULT: "#D4900C",
          dark: "#E8A020",
          text: "#9A6708",
          50: "#FEF8EC",
          100: "#FDF0D1",
          200: "#FAE0A5",
          300: "#F6CA72",
          400: "#F1B040",
          500: "#E8A020",
          600: "#D4900C",
          700: "#A06A08",
          800: "#6A440C",
          900: "#402807",
          950: "#261804",
        },
        ministry: {
          DEFAULT: "#4872B8",
          hover: "#3A5C96",
          50: "#EEF3FB",
          100: "#D5E2F5",
          200: "#ADC5EB",
          300: "#93B4DF",
          400: "#608BD4",
          500: "#4872B8",
          600: "#3A5C96",
          700: "#2D4672",
          800: "#1F3050",
          900: "#121C30",
        },
        ember: { coral: "#E8566A", orange: "#F0862E", gold: "#E8A020" },
        sunburst: { pink: "#FF2D6E", orange: "#FF7A1A", yellow: "#FFD23F" },
        success: { DEFAULT: "#16A34A", dark: "#22C55E" },
        warning: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        display: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        body: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        numeric: ["Space Mono", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "sacred-ember": "linear-gradient(135deg, #E8566A 0%, #F0862E 50%, #E8A020 100%)",
        "sacred-ember-raw": "linear-gradient(135deg, #FF2D6E 0%, #FF7A1A 50%, #FFD23F 100%)",
        "midnight-veil":
          "radial-gradient(ellipse at top right, rgba(207,58,20,0.15) 0%, transparent 55%), linear-gradient(145deg, #202024 0%, #1C1916 42%, #151308 70%, #0B0705 100%)",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-md": "0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.07)",
        gold: "0 4px 12px rgba(212,144,12,0.28)",
      },
    },
  },
};
