#!/usr/bin/env bash
# Builds apps/api/deploy-archive/ — a self-contained bundle for Hostinger's
# Node.js hosting. See scripts/deploy-copy.js for why: Hostinger's builder
# only promotes `output_directory` to the directory the app actually runs
# from, so node_modules has to live inside it and be fully self-contained
# (pnpm's default cross-package symlinks point outside that directory and go
# dangling once promoted).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
OUT="$API_DIR/deploy-archive"

cd "$REPO_ROOT"
pnpm --filter @gch/database run generate
pnpm --filter @gch/database run build
pnpm --filter @gch/api run build

rm -rf "$OUT" "$API_DIR/deploy-standalone"
pnpm --filter @gch/api deploy "$API_DIR/deploy-standalone" --prod

mkdir -p "$OUT"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$API_DIR/deploy-standalone/package.json', 'utf8'));
delete pkg.dependencies['@gch/database'];
fs.writeFileSync('$OUT/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
cp -r "$API_DIR/scripts" "$OUT/scripts"
mv "$API_DIR/deploy-standalone/dist" "$OUT/prebuilt-dist"
mv "$API_DIR/deploy-standalone/node_modules" "$OUT/vendor-node-modules"
rm -rf "$API_DIR/deploy-standalone"

# Place the generated Prisma client + query engine binary — pnpm deploy
# doesn't know about it, since prisma generate creates it as a side effect
# rather than a declared dependency.
PRISMA_CLIENT_DIR="$(find "$OUT/vendor-node-modules/.pnpm" -maxdepth 1 -iname '@prisma+client@*' | head -1)/node_modules/.prisma"
SRC_PRISMA_DIR="$(find "$REPO_ROOT/node_modules/.pnpm" -maxdepth 1 -iname '@prisma+client@*' | head -1)/node_modules/.prisma"
rm -rf "$PRISMA_CLIENT_DIR"
mkdir -p "$PRISMA_CLIENT_DIR"
cp -r "$SRC_PRISMA_DIR/client" "$PRISMA_CLIENT_DIR/"

# @prisma/engines/fetch-engine/get-platform are CLI-only (migrations,
# introspection) — @prisma/client only needs the query-engine binary already
# placed above. Pruning them saves ~35MB.
rm -rf "$OUT/vendor-node-modules/.pnpm/@prisma+engines@"* \
       "$OUT/vendor-node-modules/.pnpm/@prisma+fetch-engine@"* \
       "$OUT/vendor-node-modules/.pnpm/@prisma+get-platform@"*
rm -rf "$OUT/vendor-node-modules/@prisma/engines" \
       "$OUT/vendor-node-modules/@prisma/fetch-engine" \
       "$OUT/vendor-node-modules/@prisma/get-platform"

echo "Built $OUT ($(du -sh "$OUT" | cut -f1))"
echo "Zip it with: cd $OUT && zip -r -q ../api-deploy.zip . -x '.*'"
