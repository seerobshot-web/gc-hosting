import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
async function specs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return specs(filename);
      return entry.isFile() && entry.name.endsWith(".spec.ts") ? [filename] : [];
    }),
  );
  return files.flat().sort();
}
const files = await specs(path.join(root, "src"));
if (!files.length) throw new Error("No API test specs found");
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
