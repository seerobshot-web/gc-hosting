const basePath = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");

const withBase = (path: string) => path === "/" ? `${basePath}/` : `${basePath}${path}`;

export const siteRoutes = {
  home: withBase("/"),
  marketing: withBase("/marketing"),
  ministry: withBase("/ministry"),
  hosting: withBase("/hosting"),
  tools: withBase("/tools"),
  resources: withBase("/resources"),
  start: withBase("/start"),
  portal: withBase("/portal"),
  dashboardPreview: withBase("/dashboard-preview"),
  marketingFoundation: withBase("/marketing-foundation"),
} as const;

export type SiteRouteKey = keyof typeof siteRoutes;

export const primaryNavItems = [
  { index: "01", label: "Marketing", href: siteRoutes.marketing },
  { index: "02", label: "Ministry", href: siteRoutes.ministry },
  { index: "03", label: "Hosting", href: siteRoutes.hosting },
  { index: "04", label: "Tools", href: siteRoutes.tools },
  { index: "05", label: "Resources", href: siteRoutes.resources },
] as const;

export const routeOwnership = {
  [siteRoutes.home]: "marketing-app",
  [siteRoutes.marketing]: "marketing-app",
  [siteRoutes.ministry]: "marketing-app",
  [siteRoutes.hosting]: "marketing-app",
  [siteRoutes.tools]: "marketing-app",
  [siteRoutes.resources]: "marketing-app",
  [siteRoutes.start]: "marketing-app",
  [siteRoutes.portal]: "portal-bridge",
  [siteRoutes.dashboardPreview]: "marketing-app-preview",
  [siteRoutes.marketingFoundation]: "marketing-app-preview",
} as const;
