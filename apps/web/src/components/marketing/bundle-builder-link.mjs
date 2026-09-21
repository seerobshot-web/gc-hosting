export function buildBundleStartHref(baseHref, capabilities) {
  const target = new URL(baseHref, "https://gch.local");
  target.searchParams.delete("capability");
  for (const capability of capabilities) {
    target.searchParams.append("capability", capability);
  }
  return `${target.pathname}${target.search}${target.hash}`;
}
