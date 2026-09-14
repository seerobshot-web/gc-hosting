import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDashboardOverview } from "@/lib/api-client";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default async function InfrastructureDashboardPage() {
  const session = await getSession();
  const overview = await getDashboardOverview(session?.orgId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
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
    </main>
  );
}
