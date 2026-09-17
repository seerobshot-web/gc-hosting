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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl text-ink">Settings</h1>

      {notice && (
        <p className="mt-4 rounded-md border border-success px-4 py-3 text-sm text-success">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-danger px-4 py-3 text-sm text-danger">
          {error === "forbidden" ? "You can't do that." : error}
        </p>
      )}

      <section className="mt-8 rounded-md border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ink-muted">{me.email}</p>
        <form action={saveProfile} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
            Name
            <input
              name="name"
              defaultValue={me.name ?? ""}
              maxLength={120}
              className="rounded-md border border-ink/10 px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm text-brand">
            Save
          </button>
        </form>
      </section>

      {manageOrg && org && (
        <>
          <section className="mt-8 rounded-md border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg text-ink">Workspace</h2>
            <p className="mt-1 text-xs text-ink-muted">/{org.slug}</p>
            <form action={saveOrgName} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
                Name
                <input
                  name="name"
                  defaultValue={org.name}
                  required
                  maxLength={120}
                  className="rounded-md border border-ink/10 px-3 py-2"
                />
              </label>
              <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm text-brand">
                Save
              </button>
            </form>
          </section>

          <section className="mt-8 rounded-md border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg text-ink">Domains &amp; auto-join</h2>
            <p className="mt-1 text-sm text-ink-sub">
              Prove you own a domain by publishing a DNS TXT record. Only a verified domain can be
              used for auto-join, which adds anyone who signs up with an email at that domain as a
              member automatically.
            </p>

            <ul className="mt-4 flex flex-col gap-3">
              {domains.map((d) => (
                <li key={d.id} className="rounded-md border border-ink/10 bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-ink">{d.domain}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        d.verifiedAt ? "bg-success text-white" : "bg-cream-dim text-ink"
                      }`}
                    >
                      {d.verifiedAt ? "verified" : "pending"}
                    </span>
                    <span className="flex-1" />
                    {!d.verifiedAt && (
                      <form action={verifyOrgDomain}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className="text-xs text-gold-text underline">
                          Check DNS
                        </button>
                      </form>
                    )}
                    <form action={removeOrgDomain}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="text-xs text-gold-text underline">Remove</button>
                    </form>
                  </div>
                  {!d.verifiedAt && d.dns && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs text-ink-sub">
                      <dt>Type</dt><dd>{d.dns.type}</dd>
                      <dt>Host</dt><dd className="break-all">{d.dns.host}</dd>
                      <dt>Value</dt><dd className="break-all">{d.dns.value}</dd>
                    </dl>
                  )}
                </li>
              ))}
            </ul>

            <form action={addOrgDomain} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
                Add a domain
                <input
                  name="domain"
                  placeholder="ministry.org"
                  required
                  className="rounded-md border border-ink/10 px-3 py-2"
                />
              </label>
              <button type="submit" className="rounded-md border border-ink/10 px-4 py-2 text-sm text-ink">
                Add
              </button>
            </form>

            <form action={setAutoJoin} className="mt-6 flex flex-wrap items-end gap-3 border-t border-ink/10 pt-4">
              <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
                Auto-join domain
                <select
                  name="autoJoinDomain"
                  defaultValue={org.autoJoinDomain ?? ""}
                  className="rounded-md border border-ink/10 bg-white px-3 py-2"
                >
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
                className="rounded-md bg-gold px-4 py-2 text-sm text-brand disabled:opacity-50"
              >
                Save
              </button>
              {verified.length === 0 && (
                <p className="w-full text-xs text-ink-muted">
                  Verify a domain first to enable auto-join.
                </p>
              )}
            </form>
          </section>
        </>
      )}
    </main>
  );
}
