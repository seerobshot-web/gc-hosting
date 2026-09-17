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
        <p className="text-ink">Sign in to a workspace to manage billing.</p>
      </main>
    );
  }

  if (!can(session, "billing:manage")) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Billing</h1>
        <p className="mt-4 text-ink-sub">
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
      <h1 className="font-display text-2xl text-ink">Billing</h1>
      <p className="mt-1 text-sm text-ink-muted">{session.org.name}</p>

      {params.checkout === "success" && (
        <p className="mt-4 rounded-md border border-success bg-white px-4 py-3 text-sm text-success">
          Thanks — your subscription is being activated. This page updates as soon as Stripe
          confirms it.
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded-md border border-danger px-4 py-3 text-sm text-danger">
          {params.error === "forbidden" ? "You can't do that." : params.error}
        </p>
      )}

      <section className="mt-8 rounded-md border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg text-ink">Current plan</h2>
        {live && subscription ? (
          <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-muted">Plan</dt>
            <dd className="text-ink">{subscription.plan?.name ?? "—"}</dd>
            <dt className="text-ink-muted">Status</dt>
            <dd className="text-ink">
              {subscription.status}
              {subscription.cancelAtPeriodEnd && " · cancels at period end"}
            </dd>
            <dt className="text-ink-muted">Seats</dt>
            <dd className="text-ink">
              {seatsUsed} in use
              {subscription.plan?.seatLimit != null && ` of ${subscription.plan.seatLimit}`}
              {subscription.seatsPurchased !== seatsUsed &&
                ` (billing ${subscription.seatsPurchased}, syncing)`}
            </dd>
            <dt className="text-ink-muted">
              {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}
            </dt>
            <dd className="text-ink">{date(subscription.currentPeriodEnd)}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-sub">
            No active subscription. {seatsUsed} member{seatsUsed === 1 ? "" : "s"} in this
            workspace.
          </p>
        )}
        {subscription && (
          <form action={openBillingPortal} className="mt-4">
            <button
              type="submit"
              className="rounded-md bg-gold px-4 py-2 text-sm text-brand"
            >
              Manage billing
            </button>
            <span className="ml-3 text-xs text-ink-muted">
              Payment method, plan changes, and cancellation — handled by Stripe.
            </span>
          </form>
        )}
      </section>

      {!live && plans.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg text-ink">Choose a plan</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const tooSmall = plan.seatLimit != null && seatsUsed > plan.seatLimit;
              return (
                <li key={plan.id} className="rounded-md border border-ink/10 bg-white p-4">
                  <p className="font-medium text-ink">{plan.name}</p>
                  <p className="mt-1 text-sm text-ink-sub">
                    {money(plan.pricePerSeatCents)} per seat / month
                    {plan.seatLimit != null && ` · up to ${plan.seatLimit} seats`}
                  </p>
                  <form action={startCheckout} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <button
                      type="submit"
                      disabled={tooSmall}
                      className="rounded-md bg-gold px-3 py-1.5 text-sm text-brand disabled:opacity-50"
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
        <h2 className="font-display text-lg text-ink">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No invoices yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="text-ink">
                    {date(inv.periodStart)} – {date(inv.periodEnd)}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-ink-muted">{inv.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-ink">{money(inv.amountDueCents, inv.currency)}</p>
                  {inv.hostedInvoiceUrl && (
                    <a
                      href={inv.hostedInvoiceUrl}
                      className="text-xs text-gold-text underline"
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
