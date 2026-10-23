import type { ToolDemoRecord, ToolPreviewMode } from "./toolTypes";

const demoHost = "https://shop.gloryhost.cloud";

const previewModes: Record<string, ToolPreviewMode> = {
  "business-website": "workstation",
  "ai-website-builder": "workstation",
  "web-hosting": "infrastructure",
  "web-builder": "workstation",
  "domain-registration": "infrastructure",
  "plugin-theme-white-label": "workstation",
  "managed-seo": "service",
  "social-media-automation": "workstation",
  "social-media-marketing": "service",
  "reputation-reviews": "workstation",
  "link-in-bio": "device",
  "business-phone": "workstation",
  "appointment-booking": "device",
  "document-signing": "workstation",
  "windows-vpn": "infrastructure",
  "esim-packages": "device",
  "cpanel-email-files": "infrastructure",
  "private-ai-box": "infrastructure",
};

const labels: Record<ToolPreviewMode, string> = {
  workstation: "Workspace preview",
  device: "Device preview",
  infrastructure: "Infrastructure preview",
  service: "Service proof",
};

export const toolDemoRecords: readonly ToolDemoRecord[] = Object.entries(previewModes).map(
  ([slug, previewMode], index) => ({
    slug,
    code: `SAA-${String(index + 1).padStart(2, "0")}`,
    status: slug === "business-phone" ? "verified" : "unverified",
    demoUrl:
      slug === "business-phone"
        ? `${demoHost}/phone-manager/?page=demo`
        : null,
    previewMode,
    previewLabel: labels[previewMode],
    audience:
      slug === "business-phone"
        ? ["business", "ministry", "nonprofit"]
        : [],
  }),
);

export function getToolDemo(slug: string): ToolDemoRecord {
  const record = toolDemoRecords.find((item) => item.slug === slug);
  if (!record) {
    return {
      slug,
      code: "SAA-00",
      status: "unavailable",
      demoUrl: null,
      previewMode: "service",
      previewLabel: labels.service,
      audience: [],
    };
  }
  return record;
}
