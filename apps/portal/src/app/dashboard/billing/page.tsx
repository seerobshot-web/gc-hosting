import { can, getSession } from "@/lib/session";
import { getBillingSubscription, getInvoices, getPlans } from "@/lib/api-client";
import { openBillingPortal, startCheckout } from "./actions";

const LIVE = new Set(["active", "trialing", "past_due"]);

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function date(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;

  if (!session?.org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-hearth-ink">Sign in to a workspace to manage billing.</p>
      </main>
    );
  }

  if (!can(session, "billing:manage")) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-hearth-ink">Billing</h1>
        <p className="mt-4 text-hearth-ink/80">
          Only a workspace owner can view or change billing for {session.org.name}.
        </p>
      </main>
    );
  }

  const [{ subscription, seatsUsed }, invoices, plans] = await Promise.all([
    getBillingSubscription(session.org.id, session.accessToken),
    getInvoices(session.org.id, session.accessToken),
    getPlans(session.accessToken),
  ]);
  const live = subscription !== null && LIVE.has(subscription.status);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl text-hearth-ink">Billing</h1>
      <p className="mt-1 text-sm text-hearth-ink/60">{session.org.name}</p>

      {params.checkout === "success" && (
        <p className="mt-4 rounded-md border border-verdigris-sky bg-cloudlight px-4 py-3 text-sm text-verdigris-sky">
          Thanks — your subscription is being activated. This page updates as soon as Stripe
          confirms it.
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded-md border border-ember-core px-4 py-3 text-sm text-ember-core">
          {params.error === "forbidden" ? "You can't do that." : params.error}
        </p>
      )}

      <section className="mt-8 rounded-md border border-ash-stone bg-cloudlight p-5">
        <h2 className="font-display text-lg text-hearth-ink">Current plan</h2>
        {live && subscription ? (
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-hearth-ink/60">Plan</dt>
            <dd className="text-hearth-ink">{subscription.plan?.name ?? "—"}</dd>
            <dt className="text-hearth-ink/60">Status</dt>
            <dd className="text-hearth-ink">
              {subscription.status}
              {subscription.cancelAtPeriodEnd && " · cancels at period end"}
            </dd>
            <dt className="text-hearth-ink/60">Seats</dt>
            <dd className="text-hearth-ink">
              {seatsUsed} in use
              {subscription.plan?.seatLimit != null && ` of ${subscription.plan.seatLimit}`}
              {subscription.seatsPurchased !== seatsUsed &&
                ` (billing ${subscription.seatsPurchased}, syncing)`}
            </dd>
            <dt className="text-hearth-ink/60">
              {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}
            </dt>
            <dd className="text-hearth-ink">{date(subscription.currentPeriodEnd)}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-hearth-ink/80">
            No active subscription. {seatsUsed} member{seatsUsed === 1 ? "" : "s"} in this
            workspace.
          </p>
        )}
        {subscription && (
          <form action={openBillingPortal} className="mt-4">
            <button
              type="submit"
              className="rounded-md bg-ember-core px-4 py-2 text-sm text-cloudlight"
            >
              Manage billing
            </button>
            <span className="ml-3 text-xs text-hearth-ink/60">
              Payment method, plan changes, and cancellation — handled by Stripe.
            </span>
          </form>
        )}
      </section>

      {!live && plans.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg text-hearth-ink">Choose a plan</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const tooSmall = plan.seatLimit != null && seatsUsed > plan.seatLimit;
              return (
                <li key={plan.id} className="rounded-md border border-ash-stone bg-cloudlight p-4">
                  <p className="font-medium text-hearth-ink">{plan.name}</p>
                  <p className="mt-1 text-sm text-hearth-ink/80">
                    {money(plan.pricePerSeatCents)} per seat / month
                    {plan.seatLimit != null && ` · up to ${plan.seatLimit} seats`}
                  </p>
                  <form action={startCheckout} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <button
                      type="submit"
                      disabled={tooSmall}
                      className="rounded-md bg-ember-core px-3 py-1.5 text-sm text-cloudlight disabled:opacity-50"
                    >
                      {tooSmall ? `Needs ≤ ${plan.seatLimit} members` : "Subscribe"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg text-hearth-ink">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-hearth-ink/60">No invoices yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ash-stone rounded-md border border-ash-stone bg-cloudlight">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="text-hearth-ink">
                    {date(inv.periodStart)} – {date(inv.periodEnd)}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-hearth-ink/60">{inv.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-hearth-ink">{money(inv.amountDueCents, inv.currency)}</p>
                  {inv.hostedInvoiceUrl && (
                    <a
                      href={inv.hostedInvoiceUrl}
                      className="text-xs text-verdigris-sky underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
