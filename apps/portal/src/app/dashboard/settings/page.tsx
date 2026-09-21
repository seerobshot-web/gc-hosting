import type { Metadata } from "next";
import { Card, PageHeader, SectionTitle, StatusDot, buttonGhost, buttonPrimary, linkGold } from "@/components/ui";
import { can, getSession } from "@/lib/session";
import { getDomains, getMe, getOrg, type DomainVerification, type Org } from "@/lib/api-client";
import {
  addOrgDomain,
  removeOrgDomain,
  saveOrgName,
  saveProfile,
  setAutoJoin,
  verifyOrgDomain,
} from "./actions";

export const metadata: Metadata = { title: "Settings | GCH Client Portal" };

const input =
  "h-10 rounded-lg border border-ink/10 bg-white px-3 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";
const label = "flex flex-1 flex-col gap-1.5 text-sm text-ink";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const session = await getSession();
  const { error, notice } = await searchParams;

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink">Sign in to manage your settings.</p>
      </main>
    );
  }

  const manageOrg = session.org !== null && can(session, "org:manage");
  const [me, org, domains] = await Promise.all([
    getMe(session.accessToken),
    manageOrg ? getOrg(session.org!.id, session.accessToken) : Promise.resolve<Org | null>(null),
    manageOrg
      ? getDomains(session.org!.id, session.accessToken)
      : Promise.resolve<DomainVerification[]>([]),
  ]);
  const verified = domains.filter((d) => d.verifiedAt);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">
      <PageHeader eyebrow={session.org?.name} title="Settings" description="Profile, workspace, and domains." />

      {notice && (
        <p className="mt-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error === "forbidden" ? "You can't do that." : error}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[400px_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <SectionTitle>Profile</SectionTitle>
            <p className="mt-1 mb-3 text-xs text-ink-muted">{me.email}</p>
            <form action={saveProfile} className="flex flex-col gap-3">
              <label className={label}>
                Name
                <input name="name" defaultValue={me.name ?? ""} maxLength={120} className={input} />
              </label>
              <button type="submit" className={`${buttonPrimary} self-start`}>
                Save
              </button>
            </form>
          </Card>

          {manageOrg && org && (
            <Card>
              <SectionTitle>Workspace</SectionTitle>
              <p className="mt-1 mb-3 font-numeric text-[11px] text-ink-muted">/{org.slug}</p>
              <form action={saveOrgName} className="flex flex-col gap-3">
                <label className={label}>
                  Name
                  <input name="name" defaultValue={org.name} required maxLength={120} className={input} />
                </label>
                <button type="submit" className={`${buttonPrimary} self-start`}>
                  Save
                </button>
              </form>
            </Card>
          )}
        </div>

        {manageOrg && org && (
          <Card>
            <SectionTitle>Domains &amp; auto-join</SectionTitle>
            <p className="mt-2 mb-1 text-xs leading-relaxed text-ink-sub">
              Verify a domain by publishing a DNS TXT record. Only a verified domain can be used for
              auto-join, which adds anyone who signs up with that email domain automatically.
            </p>

            <ul>
              {domains.map((d) => (
                <li key={d.id} className="border-t border-ink/10 py-3 first:border-t-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex-1 truncate text-sm font-semibold text-ink">{d.domain}</span>
                    <StatusDot tone={d.verifiedAt ? "success" : "muted"} label={d.verifiedAt ? "Verified" : "Pending"} />
                    {!d.verifiedAt && (
                      <form action={verifyOrgDomain}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className={linkGold}>
                          Check DNS
                        </button>
                      </form>
                    )}
                    <form action={removeOrgDomain}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="font-display text-[11px] font-bold uppercase tracking-[0.06em] text-danger hover:underline">
                        Remove
                      </button>
                    </form>
                  </div>
                  {!d.verifiedAt && d.dns && (
                    <dl className="mt-2.5 grid grid-cols-[56px_1fr] gap-x-3 gap-y-1 rounded-lg bg-cream-dim p-3 font-numeric text-[11px] text-ink-sub">
                      <dt className="text-ink-muted">Type</dt>
                      <dd>{d.dns.type}</dd>
                      <dt className="text-ink-muted">Host</dt>
                      <dd className="break-all">{d.dns.host}</dd>
                      <dt className="text-ink-muted">Value</dt>
                      <dd className="break-all">{d.dns.value}</dd>
                    </dl>
                  )}
                </li>
              ))}
            </ul>

            <form action={addOrgDomain} className="mt-3.5 flex flex-wrap items-end gap-3">
              <label className={label}>
                Add a domain
                <input name="domain" placeholder="ministry.org" required className={input} />
              </label>
              <button type="submit" className={buttonGhost}>
                Add
              </button>
            </form>

            <form
              action={setAutoJoin}
              className="mt-3.5 flex flex-wrap items-end gap-3 border-t border-ink/10 pt-3.5"
            >
              <label className={label}>
                Auto-join domain
                <select name="autoJoinDomain" defaultValue={org.autoJoinDomain ?? ""} className={input}>
                  <option value="">Off</option>
                  {verified.map((d) => (
                    <option key={d.id} value={d.domain}>
                      @{d.domain}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={verified.length === 0 && !org.autoJoinDomain}
                className={buttonPrimary}
              >
                Save
              </button>
              {verified.length === 0 && (
                <p className="w-full text-xs text-ink-muted">Verify a domain first to enable auto-join.</p>
              )}
            </form>
          </Card>
        )}
      </div>
    </main>
  );
}
