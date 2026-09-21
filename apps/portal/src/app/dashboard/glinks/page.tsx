import type { Metadata } from "next";
import Link from "next/link";
import { Card, Eyebrow, PageHeader, buttonGhost } from "@/components/ui";
import { can, getSession } from "@/lib/session";
import { getClientsForOrg, getGLinksForClient } from "@/lib/api-client";

export const metadata: Metadata = { title: "GloryLink | GCH Client Portal" };

const LEGEND = [
  { label: "Giving", color: "bg-ember-coral" },
  { label: "Events", color: "bg-ember-orange" },
  { label: "Sermon series", color: "bg-gold" },
  { label: "Announcements", color: "bg-ministry" },
];

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default async function GLinksDashboardPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink">Sign in required to manage your GloryLink page.</p>
      </main>
    );
  }

  if (!session.org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">Your GloryLink</h1>
        <p className="mt-4 text-sm text-ink-sub">
          Your account isn&apos;t part of a workspace yet. Ask a workspace owner to add you, or contact
          support.
        </p>
      </main>
    );
  }

  // The caller's own Client (linked by userId) wins; otherwise the org's
  // first Client — a single-tenant ministry has exactly one either way.
  const clients = await getClientsForOrg(session.org.id, session.accessToken);
  const client = clients.find((c) => c.userId === session.userId) ?? clients[0] ?? null;
  const glinks = client ? await getGLinksForClient(client.id, session.accessToken) : [];
  const viewOnly = !can(session, "glink:write");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">
      <PageHeader
        eyebrow={session.org.name}
        title="GloryLink"
        description={`${session.org.role.toLowerCase()}${viewOnly ? " · view only" : ""}`}
      />

      {glinks.length > 0 ? (
        <Card className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left">
                {["Module", "Label"].map((h) => (
                  <th key={h} className="pb-2.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {glinks.map((link) => (
                <tr key={link.id} className="border-t border-ink/10">
                  <td className="py-3 pr-3">
                    <span className="font-display text-[10px] font-bold uppercase tracking-[0.06em] text-ministry">
                      {link.moduleType.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 font-medium text-ink">{link.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="mt-6 flex justify-center">
          <Card className="flex w-full max-w-2xl overflow-hidden !p-0">
            <div className="flex-1 p-8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ministry/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} stroke="#4872B8">
                    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                  </svg>
                </span>
                <Eyebrow className="text-ministry">GLinks · Coming soon</Eyebrow>
              </div>
              <h2 className="mt-4 font-display text-xl font-extrabold uppercase leading-tight text-ink">
                One link for your whole ministry.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-sub">
                Giving, events, sermons, and announcements on a single page your congregation can reach
                from anywhere. Launching after the initial hosting rollout.
              </p>
              <div className="mt-4 flex flex-col gap-2 text-sm">
                {LEGEND.map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5 text-ink">
                    <span className={`inline-block h-[7px] w-[7px] rounded-full ${item.color}`} />
                    {item.label}
                  </div>
                ))}
              </div>
              <Link href="/dashboard" className={`${buttonGhost} mt-5`}>
                Back to overview
              </Link>
            </div>
            <div className="hidden w-[220px] flex-col justify-between bg-ministry p-6 text-white sm:flex">
              <div>
                <Eyebrow className="text-white/70">Preview</Eyebrow>
                <div className="mt-3.5 rounded-2xl bg-white/10 p-3.5">
                  <div className="mx-auto h-9 w-9 rounded-full bg-sacred-ember" />
                  <div className="mt-2.5 text-center font-display text-[10px] font-bold uppercase tracking-[0.06em]">
                    {session.org.name}
                  </div>
                  <div className="mt-2.5 h-6 rounded-full bg-white/20" />
                  <div className="mt-1.5 h-6 rounded-full bg-white/20" />
                  <div className="mt-1.5 h-6 rounded-full bg-white/20" />
                </div>
              </div>
              <div className="font-numeric text-[10px] text-white/70">glinks.app/{session.org.slug}</div>
            </div>
          </Card>
        </div>
      )}

      {glinks.length === 0 && !client && (
        <p className="mt-4 text-center text-sm text-ink-muted">
          No hosting client is linked to this workspace yet.
        </p>
      )}
    </main>
  );
}
