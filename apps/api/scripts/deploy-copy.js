// Replaces whatever `pnpm install` produced with a known-good, fully
// self-contained node_modules (built with `pnpm deploy`, so it has no
// symlinks pointing outside this directory) plus the compiled dist/ output
// and the generated Prisma client + query engine binary. Used as the
// Hostinger Node.js build step instead of building there directly — see the
// PR that introduced this for why: Hostinger only promotes `output_directory`
// to the directory the app actually runs from, so node_modules has to live
// inside it and can't rely on pnpm's default cross-package symlinks, which
// point outside that directory and go dangling once promoted.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

fs.rmSync(path.join(root, "node_modules"), { recursive: true, force: true });
fs.cpSync(path.join(root, "vendor-node-modules"), path.join(root, "node_modules"), {
  recursive: true,
});
fs.cpSync(path.join(root, "prebuilt-dist"), path.join(root, "dist"), {
  recursive: true,
});

console.log("Replaced node_modules with the vendored bundle and copied prebuilt dist/.");
