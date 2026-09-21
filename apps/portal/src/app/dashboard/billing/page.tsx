import type { Metadata } from "next";
import { Card, Chip, PageHeader, SectionTitle, StatusDot, buttonPrimary, linkGold, type Tone } from "@/components/ui";
import { can, getSession } from "@/lib/session";
import { getBillingSubscription, getInvoices, getPlans } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";
import { openBillingPortal, startCheckout } from "./actions";

export const metadata: Metadata = { title: "Billing | GCH Client Portal" };

const LIVE = new Set(["active", "trialing", "past_due"]);

function subscriptionTone(status: string, cancelAtPeriodEnd: boolean): Tone {
  if (status === "past_due") return "warning";
  if (cancelAtPeriodEnd) return "warning";
  return "success";
}

const INVOICE_TONE: Record<string, Tone> = {
  paid: "success",
  open: "warning",
  uncollectible: "warning",
  past_due: "warning",
  draft: "muted",
  void: "muted",
};

function invoiceLabel(status: string): string {
  return status === "open" || status === "uncollectible" ? "Unpaid" : status;
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
        <h1 className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">Billing</h1>
        <p className="mt-4 text-sm text-ink-sub">
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
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">
      <PageHeader
        eyebrow={session.org.name}
        title="Billing"
        description="Plans, invoices, and payment — no setup fees, no contracts."
        actions={
          subscription && (
            <form action={openBillingPortal}>
              <button type="submit" className={buttonPrimary}>
                Manage billing
              </button>
            </form>
          )
        }
      />

      {params.checkout === "success" && (
        <p className="mt-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Thanks — your subscription is being activated. This page updates as soon as Stripe confirms it.
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {params.error === "forbidden" ? "You can't do that." : params.error}
        </p>
      )}

      <Card className="mt-6 max-w-md">
        <SectionTitle>Current plan</SectionTitle>
        {live && subscription ? (
          <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2.5 text-sm">
            <dt className="text-ink-muted">Plan</dt>
            <dd className="font-semibold text-ink">{subscription.plan?.name ?? "—"}</dd>
            <dt className="text-ink-muted">Status</dt>
            <dd>
              <StatusDot
                tone={subscriptionTone(subscription.status, subscription.cancelAtPeriodEnd)}
                label={subscription.cancelAtPeriodEnd ? `${subscription.status} · cancels at period end` : subscription.status}
              />
            </dd>
            <dt className="text-ink-muted">Seats</dt>
            <dd className="font-numeric text-ink">
              {seatsUsed}
              {subscription.plan?.seatLimit != null && ` / ${subscription.plan.seatLimit}`}
              {subscription.seatsPurchased !== seatsUsed && (
                <span className="text-xs text-ink-muted"> (billing {subscription.seatsPurchased}, syncing)</span>
              )}
            </dd>
            <dt className="text-ink-muted">{subscription.cancelAtPeriodEnd ? "Ends" : "Renews"}</dt>
            <dd className="font-numeric text-ink">{formatDate(subscription.currentPeriodEnd)}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-sub">
            No active subscription. {seatsUsed} member{seatsUsed === 1 ? "" : "s"} in this workspace.
          </p>
        )}
        <p className="mt-3.5 text-xs text-ink-muted">
          Payment method, plan changes, and cancellation are handled by Stripe.
        </p>
      </Card>

      {!live && plans.length > 0 && (
        <>
          <div className="mt-8">
            <SectionTitle>Choose a plan</SectionTitle>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const tooSmall = plan.seatLimit != null && seatsUsed > plan.seatLimit;
              return (
                <Card key={plan.id} className="p-4">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-ink">{plan.name}</p>
                  <p className="mt-1 font-numeric text-sm text-ink-sub">
                    {formatMoney(plan.pricePerSeatCents)} <span className="text-xs text-ink-muted">per seat / month</span>
                  </p>
                  {plan.seatLimit != null && (
                    <p className="mt-0.5 text-xs text-ink-muted">Up to {plan.seatLimit} seats</p>
                  )}
                  <form action={startCheckout} className="mt-3">
                    <input type="hidden" name="planId" value={plan.id} />
                    <button type="submit" disabled={tooSmall} className={`${buttonPrimary} w-full`}>
                      {tooSmall ? `Needs ≤ ${plan.seatLimit} members` : "Subscribe"}
                    </button>
                  </form>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Card className="mt-8">
        <div className="flex items-center justify-between">
          <SectionTitle>Invoices</SectionTitle>
          <span className="text-xs text-ink-muted">{invoices.length} total</span>
        </div>
        {invoices.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No invoices yet.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                {["Period", "Amount", "Status", ""].map((h) => (
                  <th key={h} className="pb-2.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                return (
                  <tr key={inv.id} className="border-t border-ink/10">
                    <td className="py-3 pr-3 text-ink">
                      {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                    </td>
                    <td className="py-3 pr-3 font-numeric font-bold text-ink">
                      {formatMoney(inv.amountDueCents, inv.currency)}
                    </td>
                    <td className="py-3 pr-3">
                      <Chip tone={INVOICE_TONE[inv.status] ?? "muted"}>{invoiceLabel(inv.status)}</Chip>
                    </td>
                    <td className="py-3 text-right">
                      {inv.hostedInvoiceUrl && (
                        <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" className={linkGold}>
                          View ›
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
