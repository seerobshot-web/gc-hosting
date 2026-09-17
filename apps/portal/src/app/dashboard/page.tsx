import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Chip, Eyebrow, PageHeader, SectionTitle, StatusDot, linkGold } from "@/components/ui";
import { can, getSession } from "@/lib/session";
import {
  getBillingSubscription,
  getDomains,
  getInvitations,
  getInvoices,
  getMembers,
  type DomainVerification,
  type Invitation,
  type Invoice,
  type Member,
  type Subscription,
} from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";
import { loadOrders, orderTone } from "@/lib/products";

export const metadata: Metadata = {
  title: "Overview | GCH Client Portal",
  description: "Your products, billing, domains, and team at a glance.",
};

const LIVE = new Set(["active", "trialing", "past_due"]);
const OPEN_INVOICE = new Set(["open", "uncollectible", "past_due"]);

async function settled<T>(p: Promise<T> | null): Promise<T | null> {
  if (!p) return null;
  try {
    return await p;
  } catch {
    return null;
  }
}

function StatCard({
  label,
  value,
  caption,
  accent,
  icon,
}: {
  label: string;
  value: ReactNode;
  caption: string;
  accent: string;
  icon: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-[9px] ${accent}`}>
          {icon}
        </span>
        <Eyebrow className="text-ink-sub">{label}</Eyebrow>
      </div>
      <div className="font-numeric text-2xl font-bold text-ink">{value}</div>
      <p className="mt-0.5 text-xs text-ink-muted">{caption}</p>
    </Card>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const ICON = {
  box: (
    <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
    </svg>
  ),
  card: (
    <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  ),
  globe: (
    <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />
    </svg>
  ),
  users: (
    <svg width="14" height="14" viewBox="0 0 24 24" {...stroke}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  link: (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  ),
};

function Checklist({ items }: { items: Array<{ label: string; done: boolean; href: string }> }) {
  return (
    <ul className="mt-2 flex flex-col">
      {items.map((it) => (
        <li key={it.label} className="border-t border-ink/10 py-2 first:border-t-0">
          <Link href={it.href} className="flex items-center gap-2.5 text-sm text-ink">
            <span
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                it.done ? "bg-success text-white" : "border-2 border-ink/20"
              }`}
              aria-hidden
            >
              {it.done && (
                <svg width="10" height="10" viewBox="0 0 24 24" {...stroke} strokeWidth={3}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className={it.done ? "text-ink-muted line-through" : ""}>{it.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function OverviewPage() {
  const session = await getSession();
  if (!session?.org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">Welcome</h1>
        <p className="mt-3 text-sm text-ink-sub">
          Your account isn&apos;t part of a workspace yet. Ask a workspace owner to add you, or accept the
          invitation link from your email.
        </p>
      </main>
    );
  }

  const { org, accessToken } = session;
  const canBilling = can(session, "billing:manage");
  const canOrg = can(session, "org:manage");
  const canInvite = can(session, "member:invite");

  const [orders, members, invitations, invoices, subscription, domains] = await Promise.all([
    settled(loadOrders(org.id, accessToken)),
    settled<Member[]>(getMembers(org.id, accessToken)),
    settled<Invitation[]>(canInvite ? getInvitations(org.id, accessToken) : null),
    settled<Invoice[]>(canBilling ? getInvoices(org.id, accessToken) : null),
    settled<{ subscription: Subscription | null; seatsUsed: number }>(
      canBilling ? getBillingSubscription(org.id, accessToken) : null,
    ),
    settled<DomainVerification[]>(canOrg ? getDomains(org.id, accessToken) : null),
  ]);

  const orderList = orders ?? [];
  const deployed = orderList.filter((o) => o.status === "deployed").length;
  const memberCount = members?.length ?? 0;
  const pendingInvites = invitations?.filter((i) => i.status === "PENDING").length ?? 0;
  const openInvoices = invoices?.filter((i) => OPEN_INVOICE.has(i.status)) ?? [];
  const openTotal = openInvoices.reduce((sum, i) => sum + i.amountDueCents, 0);
  const verifiedDomains = domains?.filter((d) => d.verifiedAt).length ?? 0;
  const billingLive = subscription?.subscription ? LIVE.has(subscription.subscription.status) : false;
  const firstName = (session.name ?? session.email).split(/[\s@]/)[0];

  const checklist = [
    ...(canOrg
      ? [{ label: "Verify your domain", done: verifiedDomains > 0, href: "/dashboard/settings" }]
      : []),
    { label: "Invite your team", done: memberCount > 1 || pendingInvites > 0, href: "/dashboard/team" },
    ...(canBilling ? [{ label: "Set up billing", done: billingLive, href: "/dashboard/billing" }] : []),
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">
      <PageHeader
        eyebrow={org.name}
        title={
          <>
            Welcome back, {firstName} <span className="text-gold">&#10022;</span>
          </>
        }
        description="Everything your ministry needs is under control."
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_272px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Products"
              value={orderList.length}
              caption={`${deployed} active`}
              accent="bg-ember-coral/15 text-danger"
              icon={ICON.box}
            />
            <StatCard
              label="Invoices due"
              value={invoices ? openInvoices.length : "—"}
              caption={
                invoices
                  ? openInvoices.length
                    ? `${formatMoney(openTotal, openInvoices[0]?.currency)} unpaid`
                    : "All paid"
                  : "Owner access"
              }
              accent="bg-ember-orange/15 text-warning"
              icon={ICON.card}
            />
            <StatCard
              label="Domains"
              value={domains ? domains.length : "—"}
              caption={
                domains
                  ? `${verifiedDomains} verified, ${domains.length - verifiedDomains} pending`
                  : "Owner access"
              }
              accent="bg-gold-100 text-gold-text"
              icon={ICON.globe}
            />
            <StatCard
              label="Team"
              value={memberCount}
              caption={pendingInvites ? `${pendingInvites} invite${pendingInvites === 1 ? "" : "s"} pending` : "No pending invites"}
              accent="bg-ministry/10 text-ministry"
              icon={ICON.users}
            />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <SectionTitle>My products</SectionTitle>
                <p className="mt-0.5 text-xs text-ink-muted">Everything active on your account.</p>
              </div>
              <Link href="/dashboard/products" className={linkGold}>
                View all ›
              </Link>
            </div>
            {orderList.length === 0 ? (
              <p className="mt-4 text-sm text-ink-muted">No products on this workspace yet.</p>
            ) : (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    {["Product", "Domain", "Status", "Next billing"].map((h) => (
                      <th
                        key={h}
                        className="pb-2.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderList.slice(0, 5).map((o) => {
                    const s = orderTone(o.status);
                    return (
                      <tr key={o.id} className="border-t border-ink/10">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-gold-100 text-gold-text">
                              {ICON.box}
                            </span>
                            <div>
                              <div className="font-semibold text-ink">Managed Hosting</div>
                              <div className="text-[11px] text-ink-muted">Hosting</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-ink">{o.primaryDomain}</td>
                        <td className="py-2.5 pr-3">
                          <StatusDot tone={s.tone} label={s.label} />
                        </td>
                        <td className="py-2.5 font-numeric text-xs text-ink">{formatDate(o.nextBillingDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {invoices ? (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <SectionTitle>My invoices</SectionTitle>
                  <Link href="/dashboard/billing" className={linkGold}>
                    View all ›
                  </Link>
                </div>
                {invoices.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">No invoices yet.</p>
                ) : (
                  <ul className="mt-2">
                    {invoices.slice(0, 3).map((inv) => {
                      const open = OPEN_INVOICE.has(inv.status);
                      return (
                        <li
                          key={inv.id}
                          className="flex items-center justify-between border-t border-ink/10 py-2 text-sm first:border-t-0"
                        >
                          <span className="font-numeric text-xs text-ink-sub">{formatDate(inv.periodStart)}</span>
                          <span className="font-numeric font-bold text-ink">
                            {formatMoney(inv.amountDueCents, inv.currency)}
                          </span>
                          <Chip tone={open ? "warning" : "success"}>{open ? "Unpaid" : inv.status}</Chip>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            ) : (
              <Card className="p-4">
                <SectionTitle>Team</SectionTitle>
                <ul className="mt-2">
                  {(members ?? []).slice(0, 4).map((m) => (
                    <li key={m.id} className="flex items-center justify-between border-t border-ink/10 py-2 text-sm first:border-t-0">
                      <span className="truncate text-ink">{m.user.name ?? m.user.email ?? "Member"}</span>
                      <span className="text-xs text-ink-muted">{m.role.toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {domains ? (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <SectionTitle>Domains</SectionTitle>
                  <Link href="/dashboard/settings" className={linkGold}>
                    Manage ›
                  </Link>
                </div>
                {domains.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">No domains added yet.</p>
                ) : (
                  <ul className="mt-2">
                    {domains.slice(0, 3).map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between border-t border-ink/10 py-2 text-sm first:border-t-0"
                      >
                        <span className="text-ink">{d.domain}</span>
                        <StatusDot tone={d.verifiedAt ? "success" : "muted"} label={d.verifiedAt ? "Verified" : "Pending"} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : (
              <Card className="p-4">
                <SectionTitle>Getting started</SectionTitle>
                <Checklist items={checklist} />
              </Card>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl bg-sacred-ember p-[18px] text-brand">
            <Eyebrow className="text-brand/70">Glory Cloud Hosts</Eyebrow>
            <div className="mt-2 font-display text-[15px] font-extrabold uppercase leading-tight">{org.name}</div>
            <p className="mt-2 text-xs leading-relaxed text-brand/80">
              {orderList.length} product{orderList.length === 1 ? "" : "s"} · {memberCount} member
              {memberCount === 1 ? "" : "s"}
            </p>
            <div className="mt-3.5 flex items-center justify-between">
              <span className="rounded-full bg-brand/10 px-2.5 py-1 font-numeric text-[10px] font-bold uppercase tracking-[0.06em]">
                {deployed} active
              </span>
              <Link
                href="/dashboard/products"
                className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                View products
              </Link>
            </div>
          </div>

          <Card className="p-[18px]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-ministry/10 text-ministry">
                {ICON.link}
              </span>
              <Eyebrow className="text-ministry">GLinks · Coming soon</Eyebrow>
            </div>
            <div className="mt-2.5 font-display text-[13px] font-bold uppercase leading-snug text-ink">
              One link for your whole ministry.
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-sub">
              Giving, events, sermons, and announcements — launching after the hosting rollout.
            </p>
            <Link
              href="/dashboard/glinks"
              className="mt-3 inline-block rounded-full border border-ministry/35 px-3.5 py-1.5 text-xs font-semibold text-ministry"
            >
              Preview
            </Link>
          </Card>

          {domains && (
            <Card className="p-[18px]">
              <SectionTitle>Getting started</SectionTitle>
              <Checklist items={checklist} />
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
