import type { Config } from "tailwindcss";
import preset from "@gch/ui/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}"],
};

export default config;
