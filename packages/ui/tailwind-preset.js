/**
 * Hex values are intentionally restated here (not imported from
 * src/tokens.ts) because Tailwind loads this config with plain Node
 * `require`, which can't resolve a .ts file without a loader. This file —
 * not src/tokens.ts — is the canonical source for anything Tailwind-facing;
 * src/tokens.ts is canonical for anything imported directly into TS/TSX.
 * Keep the two in sync if a token value ever changes.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        cloudlight: "#F6F2E7",
        "ember-core": "#A83E1B",
        "ember-gold": "#E0A537",
        "hearth-ink": "#2C231C",
        "ash-stone": "#C9C0AF",
        "verdigris-sky": "#3E6E64",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "sacred-ember": "linear-gradient(135deg, #A83E1B 0%, #E0A537 100%)",
        "midnight-veil": "linear-gradient(135deg, #2C231C 0%, #3E6E64 100%)",
      },
    },
  },
};
