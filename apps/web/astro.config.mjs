import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true" && repositoryName;

export default defineConfig({
  site: isGitHubPagesBuild
    ? `https://${process.env.GITHUB_REPOSITORY_OWNER}.github.io/${repositoryName}`
    : undefined,
  base: isGitHubPagesBuild ? `/${repositoryName}` : undefined,
  integrations: [react(), tailwind({ applyBaseStyles: false })],
});
