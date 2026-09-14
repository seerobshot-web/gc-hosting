// Copies pre-built artifacts (compiled dist/, generated Prisma client) into
// place after `pnpm install`. Used as the Hostinger Node.js build step
// instead of running `tsc` / `prisma generate` there directly — see the PR
// that introduced this for why.
const fs = require("fs");
const path = require("path");

const root = __dirname + "/..";

// 1. Compiled TypeScript output.
fs.cpSync(path.join(root, "prebuilt-dist"), path.join(root, "dist"), {
  recursive: true,
});

// 2. Generated Prisma client + query engine binary. @prisma/client's index.js
// does `require('.prisma/client/default')`, which Node resolves starting
// from @prisma/client's own directory — so `.prisma/client` must land as a
// sibling of wherever @prisma/client actually got installed.
function findPrismaClientDir(startDir) {
  const stack = [startDir];
  while (stack.length) {
    const dir = stack.pop();
    const candidate = path.join(dir, "@prisma", "client", "package.json");
    if (fs.existsSync(candidate)) return path.dirname(candidate);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("@prisma+client@")) {
        stack.push(path.join(dir, entry.name, "node_modules"));
      }
    }
  }
  return null;
}

// The pnpm virtual store (node_modules/.pnpm) usually lives at the workspace
// root, not inside this package's own node_modules — but check both.
const candidateRoots = [
  path.join(root, "..", "..", "node_modules", ".pnpm"),
  path.join(root, "node_modules", ".pnpm"),
];
let clientDir = null;
for (const candidate of candidateRoots) {
  clientDir = findPrismaClientDir(candidate);
  if (clientDir) break;
}
if (!clientDir) {
  console.error("Could not locate an installed @prisma/client to place the generated client next to.");
  process.exit(1);
}

// clientDir is .../node_modules/@prisma/client — .prisma must be a sibling
// of @prisma itself, i.e. two levels up from clientDir.
const dest = path.join(clientDir, "..", "..", ".prisma", "client");
fs.rmSync(path.join(clientDir, "..", "..", ".prisma"), { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(path.join(root, "prebuilt-prisma-client"), dest, { recursive: true });

console.log(`Copied prebuilt dist/ and .prisma/client into ${dest}`);
