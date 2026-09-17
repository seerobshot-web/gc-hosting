import type { Metadata } from "next";
import { pillars } from "@gch/ui/tokens";
import { Card, PageHeader, SectionTitle, StatusDot, linkGold } from "@/components/ui";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { loadOrders, orderTone } from "@/lib/products";

export const metadata: Metadata = { title: "Products | GCH Client Portal" };

const PILLAR_COPY: Record<(typeof pillars)[number]["key"], { blurb: string; accent: string }> = {
  hosting: { blurb: "Managed cPanel hosting, provisioned and billed in one place.", accent: "bg-gold-100 text-gold-text" },
  "ai-tools": { blurb: "AI tooling for ministry teams — content, workflows, and more.", accent: "bg-ember-orange/15 text-warning" },
  "design-marketing": { blurb: "Brand identity, content strategy, and SEO for your ministry.", accent: "bg-ember-coral/15 text-danger" },
  "ministry-education": { blurb: "GloryLink and other tools built for churches and ministries.", accent: "bg-ministry/10 text-ministry" },
};

export default async function ProductsPage() {
  const session = await getSession();
  if (!session?.org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink">Your account isn&apos;t part of a workspace yet. Ask a workspace owner to add you.</p>
      </main>
    );
  }

  const orders = await loadOrders(session.org.id, session.accessToken);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "/";

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">
      <PageHeader
        eyebrow={session.org.name}
        title="Products"
        description="Everything your ministry runs on Glory Cloud Hosts."
      />

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <SectionTitle>Your products</SectionTitle>
          <span className="text-xs text-ink-muted">
            {orders.filter((o) => o.status === "deployed").length} active
          </span>
        </div>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No products on this workspace yet.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                {["Product", "Domain", "Status", "Next billing", "cPanel user"].map((h) => (
                  <th key={h} className="pb-2.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = orderTone(o.status);
                return (
                  <tr key={o.id} className="border-t border-ink/10">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-ink">Managed Hosting</div>
                      <div className="text-[11px] text-ink-muted">Hosting</div>
                    </td>
                    <td className="py-3 pr-3 text-ink">{o.primaryDomain}</td>
                    <td className="py-3 pr-3"><StatusDot tone={s.tone} label={s.label} /></td>
                    <td className="py-3 pr-3 font-numeric text-xs text-ink">{formatDate(o.nextBillingDate)}</td>
                    <td className="py-3 font-numeric text-xs text-ink">{o.cpanelUsername}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <SectionTitle>Explore more for {session.org.name}</SectionTitle>
        <span className="text-xs text-ink-muted">Four pillars, one account.</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((p) => {
          const copy = PILLAR_COPY[p.key];
          return (
            <Card key={p.key} className="p-4">
              <span className={`inline-flex rounded-lg px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.08em] ${copy.accent}`}>
                {p.label}
              </span>
              <p className="mt-3 text-xs leading-relaxed text-ink-sub">{copy.blurb}</p>
              <a href={`${siteUrl}${p.key === "hosting" ? "" : `/${p.key}`}`} className={`mt-3 inline-block ${linkGold}`}>
                Learn more ›
              </a>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
