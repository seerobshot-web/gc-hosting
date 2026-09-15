/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gch/ui"],
  // Self-contained server bundle (.next/standalone) with a pruned
  // node_modules already inside it. Hostinger's Node.js hosting promotes
  // the build to a separate versions/<uuid>/nodejs/ directory before
  // running it, and only entry_file's own directory tree survives that
  // move -- a sibling node_modules does not (see apps/api's deploy-copy.js
  // for the same lesson learned the hard way on the api side). Standalone
  // mode is Next's own answer to that exact constraint.
  output: "standalone",
};

export default nextConfig;
