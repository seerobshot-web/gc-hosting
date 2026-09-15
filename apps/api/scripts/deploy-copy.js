// Assembles dist/ as the fully self-contained runtime directory: the
// compiled output plus a known-good node_modules (built with `pnpm deploy`,
// so it has no symlinks pointing outside this directory) and the generated
// Prisma client + query engine binary, all placed INSIDE dist/ rather than
// as siblings of it.
//
// Why: Hostinger's Node.js hosting promotes the build to a separate
// "versions/<uuid>/nodejs/" directory before running it, and empirically
// that promotion only reliably carries over entry_file's own directory tree
// (dist/, here) — a sibling node_modules next to dist does not survive the
// move ("Cannot find module" at runtime even though the build itself
// reports success). Node's own module resolution already checks the
// requiring file's own directory for node_modules before walking up parent
// directories, so nesting it inside dist/ works regardless of how the
// promotion step is implemented.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, "prebuilt-dist"), dist, { recursive: true });
fs.cpSync(path.join(root, "vendor-node-modules"), path.join(dist, "node_modules"), {
  recursive: true,
});

console.log("Assembled dist/ with compiled output and a self-contained node_modules.");
