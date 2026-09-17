import { can, getSession } from "@/lib/session";
import { getClientsForOrg, getGLinksForClient } from "@/lib/api-client";

export default async function GLinksDashboardPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink">
          Sign in required to manage your GloryLink page.
        </p>
      </main>
    );
  }

  if (!session.org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Your GloryLink</h1>
        <p className="mt-4 text-ink-sub">
          Your account isn&apos;t part of a workspace yet. Ask a workspace
          owner to add you, or contact support.
        </p>
      </main>
    );
  }

  // The caller's own Client (linked by userId) wins; otherwise the org's
  // first Client — a single-tenant ministry has exactly one either way.
  const clients = await getClientsForOrg(session.org.id, session.accessToken);
  const client =
    clients.find((c) => c.userId === session.userId) ?? clients[0] ?? null;
  const glinks = client
    ? await getGLinksForClient(client.id, session.accessToken)
    : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl text-ink">Your GloryLink</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {session.org.name} · {session.org.role.toLowerCase()}
        {!can(session, "glink:write") && " · view only"}
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {glinks.map((link) => (
          <li
            key={link.id}
            className="rounded-md border border-ink/10 bg-white px-4 py-3"
          >
            <span className="text-xs uppercase tracking-wide text-gold-text">
              {link.moduleType.replace("_", " ")}
            </span>
            <p className="font-medium text-ink">{link.label}</p>
          </li>
        ))}
        {glinks.length === 0 && (
          <li className="text-ink-muted">
            {client ? "No modules added yet." : "No hosting client is linked to this workspace yet."}
          </li>
        )}
      </ul>
    </main>
  );
}
