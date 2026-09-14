import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
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
  const overview = await getDashboardOverview();
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
    url: "/dashboard",
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Script
        id="dashboard-jsonld"
        type="application/ld+json"
      >
        {JSON.stringify(structuredData)}
      </Script>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-hearth-ink">
            Infrastructure Dashboard
          </h1>
          <p className="text-hearth-ink/70">
            Hostinger provisioning, registrations, and root tracking overview.
          </p>
        </div>
        <Link
          href="/dashboard/glinks"
          className="rounded-md border border-ash-stone px-4 py-2 text-sm font-medium text-hearth-ink"
        >
          Open GloryLink Dashboard
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-md border border-ash-stone bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-verdigris-sky">
            Total orders
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.totalOrders}
          </p>
        </article>
        <article className="rounded-md border border-ash-stone bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-verdigris-sky">
            Provisioning
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.provisioningOrders}
          </p>
        </article>
        <article className="rounded-md border border-ash-stone bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-verdigris-sky">
            Deployed
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.deployedOrders}
          </p>
        </article>
        <article className="rounded-md border border-ash-stone bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-verdigris-sky">
            Failed
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {overview.infrastructure.failedOrders}
          </p>
        </article>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        <article>
          <h2 className="font-display text-xl text-hearth-ink">
            New sign ups / registrations
          </h2>
          <p className="mt-1 text-hearth-ink/70">
            {overview.registrations.newLast7Days} in the last 7 days •{" "}
            {overview.registrations.totalClients} total
          </p>
          <ul className="mt-4 space-y-2">
            {overview.registrations.recent.map((client) => (
              <li
                key={client.id}
                className="rounded-md border border-ash-stone bg-white px-4 py-3"
              >
                <p className="font-medium">{client.email}</p>
                <p className="text-sm text-hearth-ink/70">
                  Registered {formatDate(client.createdAt)}
                </p>
              </li>
            ))}
            {overview.registrations.recent.length === 0 && (
              <li className="text-hearth-ink/60">No registrations yet.</li>
            )}
          </ul>
        </article>

        <article>
          <h2 className="font-display text-xl text-hearth-ink">Root tracking</h2>
          <p className="mt-1 text-hearth-ink/70">
            Latest domain roots and deployment status on Hostinger.
          </p>
          <ul className="mt-4 space-y-2">
            {overview.rootTracking.map((order) => (
              <li
                key={order.id}
                className="rounded-md border border-ash-stone bg-white px-4 py-3"
              >
                <p className="font-medium">{order.primaryDomain}</p>
                <p className="text-sm text-hearth-ink/70">
                  {order.cpanelUsername} • {order.status} • {order.host}
                </p>
                <p className="text-xs text-hearth-ink/60">
                  Updated {formatDate(order.updatedAt)}
                </p>
              </li>
            ))}
            {overview.rootTracking.length === 0 && (
              <li className="text-hearth-ink/60">No tracked roots yet.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-hearth-ink">API route health</h2>
        <p className="mt-1 text-hearth-ink/70">
          Route-level health for all current API destinations.
        </p>
        <ul className="mt-4 grid gap-2">
          {overview.apiRouteHealth.map((route) => (
            <li
              key={`${route.method}:${route.path}`}
              className="rounded-md border border-ash-stone bg-white px-4 py-3 text-sm"
            >
              <p className="font-medium">
                {route.method} {route.path}
              </p>
              <p className="text-hearth-ink/70">
                {route.status} • {route.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-hearth-ink">
          Page destinations, backlinks, and SEO structure plan
        </h2>
        <p className="mt-1 text-hearth-ink/70">
          Destination mapping for backlink strategy and search-console metadata strengthening.
        </p>
        <ul className="mt-4 space-y-2">
          {overview.pageDestinations.map((destination) => (
            <li
              key={destination.path}
              className="rounded-md border border-ash-stone bg-white px-4 py-3"
            >
              <p className="font-medium">{destination.path}</p>
              <p className="text-sm text-hearth-ink/70">{destination.purpose}</p>
              <p className="text-sm text-hearth-ink/70">
                Backlink: {destination.backlinkFocus}
              </p>
              <p className="text-sm text-hearth-ink/70">
                Structured content: {destination.structuredContentType}
              </p>
              <p className="text-sm text-hearth-ink/70">
                Metadata focus: {destination.metadataFocus}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
