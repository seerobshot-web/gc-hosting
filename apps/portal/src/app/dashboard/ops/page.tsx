import type { Metadata } from "next";
import Link from "next/link";
import { can, getSession } from "@/lib/session";
import { getDashboardOverview } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "Infrastructure Dashboard | GCH Client Portal",
  description:
    "Monitor Hostinger provisioning, API route health, new registrations, root tracking, and SEO destination planning.",
  keywords: [
    "Hostinger dashboard",
    "API route health",
    "registration tracking",
    "SEO structured data",
    "search console metadata",
  ],
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default async function InfrastructureDashboardPage() {
  const session = await getSession();

  if (!session?.org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink">Sign in to a workspace to view infrastructure health.</p>
      </main>
    );
  }

  if (!can(session, "member:manage")) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Infrastructure Dashboard</h1>
        <p className="mt-4 text-ink-sub">
          Only workspace admins and owners can view infrastructure health for {session.org.name}.
        </p>
      </main>
    );
  }

  const overview = await getDashboardOverview();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "GCH Infrastructure Dashboard",
    description:
      "Operational dataset for API route health, registrations, and root tracking on Hostinger.",
    about: [
      "API health monitoring",
      "Client registration tracking",
      "Hostinger root and deployment tracking",
      "SEO destination planning",
    ],
    url: `${siteUrl}/dashboard`,
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">
            Infrastructure Dashboard
          </h1>
          <p className="text-ink-sub">
            Hostinger provisioning, registrations, and root tracking overview.
          </p>
        </div>
        <Link
          href="/dashboard/glinks"
          className="rounded-md border border-ink/10 px-4 py-2 text-sm font-medium text-ink"
        >
          Open GloryLink Dashboard
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-md border border-ink/10 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gold-text">
            Total orders
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.totalOrders}
          </p>
        </article>
        <article className="rounded-md border border-ink/10 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gold-text">
            Provisioning
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.provisioningOrders}
          </p>
        </article>
        <article className="rounded-md border border-ink/10 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gold-text">
            Deployed
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.deployedOrders}
          </p>
        </article>
        <article className="rounded-md border border-ink/10 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-gold-text">
            Failed
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.failedOrders}
          </p>
        </article>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        <article>
          <h2 className="font-display text-xl text-ink">
            New sign ups / registrations
          </h2>
          <p className="mt-1 text-ink-sub">
            {overview.registrations.newLast7Days} in the last 7 days •{" "}
            {overview.registrations.totalClients} total
          </p>
          <ul className="mt-4 space-y-2">
            {overview.registrations.recent.map((client) => (
              <li
                key={client.id}
                className="rounded-md border border-ink/10 bg-white px-4 py-3"
              >
                <p className="font-medium">{client.email}</p>
                <p className="text-sm text-ink-sub">
                  Registered {formatDate(client.createdAt)}
                </p>
              </li>
            ))}
            {overview.registrations.recent.length === 0 && (
              <li className="text-ink-muted">No registrations yet.</li>
            )}
          </ul>
        </article>

        <article>
          <h2 className="font-display text-xl text-ink">Root tracking</h2>
          <p className="mt-1 text-ink-sub">
            Latest domain roots and deployment status on Hostinger.
          </p>
          <ul className="mt-4 space-y-2">
            {overview.rootTracking.map((order) => (
              <li
                key={order.id}
                className="rounded-md border border-ink/10 bg-white px-4 py-3"
              >
                <p className="font-medium">{order.primaryDomain}</p>
                <p className="text-sm text-ink-sub">
                  {order.cpanelUsername} • {order.status} • {order.host}
                </p>
                <p className="text-xs text-ink-muted">
                  Updated {formatDate(order.updatedAt)}
                </p>
              </li>
            ))}
            {overview.rootTracking.length === 0 && (
              <li className="text-ink-muted">No tracked roots yet.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">API route health</h2>
        <p className="mt-1 text-ink-sub">
          Route-level health for all current API destinations.
        </p>
        <ul className="mt-4 grid gap-2">
          {overview.apiRouteHealth.map((route) => (
            <li
              key={`${route.method}:${route.path}`}
              className="rounded-md border border-ink/10 bg-white px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {route.method} {route.path}
              </p>
              <p className="text-ink-sub">
                {route.status} • {route.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">
          Page destinations, backlinks, and SEO structure plan
        </h2>
        <p className="mt-1 text-ink-sub">
          Destination mapping for backlink strategy and search-console metadata strengthening.
        </p>
        <ul className="mt-4 space-y-2">
          {overview.pageDestinations.map((destination) => (
            <li
              key={destination.path}
              className="rounded-md border border-ink/10 bg-white px-4 py-3"
            >
              <p className="font-medium">{destination.path}</p>
              <p className="text-sm text-ink-sub">{destination.purpose}</p>
              <p className="text-sm text-ink-sub">
                Backlink: {destination.backlinkFocus}
              </p>
              <p className="text-sm text-ink-sub">
                Structured content: {destination.structuredContentType}
              </p>
              <p className="text-sm text-ink-sub">
                Metadata focus: {destination.metadataFocus}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
