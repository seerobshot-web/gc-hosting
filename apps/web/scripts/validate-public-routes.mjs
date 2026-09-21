import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";

const root = new URL("../", import.meta.url);
const srcDir = new URL("./src/", root);
const pagesDir = new URL("./src/pages/", root);

const routeFiles = new Map([
  ["/", "index.astro"],
  ["/marketing", "marketing.astro"],
  ["/ministry", "ministry.astro"],
  ["/hosting", "hosting.astro"],
  ["/tools", "tools.astro"],
  ["/resources", "resources.astro"],
  ["/start", "start.astro"],
  ["/portal", "portal.astro"],
  ["/dashboard-preview", "dashboard-preview.astro"],
  ["/marketing-foundation", "marketing-foundation.astro"],
]);

async function exists(url) {
  try {
    await stat(url);
    return true;
  } catch {
    return false;
  }
}

async function walk(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else if (/\.(astro|tsx?|jsx?)$/.test(entry.name)) files.push(child);
  }
  return files;
}

const failures = [];

for (const [route, file] of routeFiles) {
  if (!(await exists(new URL(file, pagesDir)))) {
    failures.push(`Missing route file for ${route}: src/pages/${file}`);
  }
}

const sourceFiles = await walk(srcDir);
const staticHrefPattern = /href\s*=\s*["'](\/[^"'#?]*)[^"']*["']/g;

for (const fileUrl of sourceFiles) {
  const source = await readFile(fileUrl, "utf8");
  let match;
  while ((match = staticHrefPattern.exec(source))) {
    const href = match[1].replace(/\/$/, "") || "/";
    if (!routeFiles.has(href)) {
      const filePath = relative(new URL(".", root).pathname, fileUrl.pathname).split(sep).join("/");
      failures.push(`Unregistered static href ${href} in ${filePath}`);
    }
  }
}

if (failures.length) {
  console.error("Public route validation failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public route validation passed for ${routeFiles.size} registered routes.`);
