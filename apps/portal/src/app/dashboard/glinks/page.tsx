import { getSession } from "@/lib/session";
import { getGLinksForClient } from "@/lib/api-client";

export default async function GLinksDashboardPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-hearth-ink">
          Sign in required to manage your GloryLink page.
        </p>
      </main>
    );
  }

  // TODO(Stage 1): resolve the logged-in User to their Client/Org via
  // Membership once that model exists — a User isn't tied to a specific
  // clientId yet on its own (see packages/database/prisma/schema.prisma's
  // Client.userId link and the Membership model).
  const clientId = null as string | null;
  const glinks = clientId
    ? await getGLinksForClient(clientId, session.accessToken)
    : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl text-hearth-ink">Your GloryLink</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {glinks.map((link) => (
          <li
            key={link.id}
            className="rounded-md border border-ash-stone bg-cloudlight px-4 py-3"
          >
            <span className="text-xs uppercase tracking-wide text-verdigris-sky">
              {link.moduleType.replace("_", " ")}
            </span>
            <p className="font-medium text-hearth-ink">{link.label}</p>
          </li>
        ))}
        {glinks.length === 0 && (
          <li className="text-hearth-ink/60">No modules added yet.</li>
        )}
      </ul>
    </main>
  );
}
