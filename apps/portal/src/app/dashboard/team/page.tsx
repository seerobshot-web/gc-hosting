import { can, getSession } from "@/lib/session";
import { getInvitations, getMembers, type Invitation } from "@/lib/api-client";
import { changeRole, invite, remove, resend, revoke } from "./actions";

const ROLE_STYLE: Record<string, string> = {
  OWNER: "bg-gold text-brand",
  ADMIN: "bg-gold-100 text-gold-text",
  MEMBER: "bg-cream-dim text-ink",
};

function date(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const { error } = await searchParams;

  if (!session?.org) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink">Sign in to a workspace to see its team.</p>
      </main>
    );
  }

  const canInvite = can(session, "member:invite");
  const canManage = can(session, "member:manage");
  const isOwner = session.org.role === "OWNER";

  const [members, invitations] = await Promise.all([
    getMembers(session.org.id, session.accessToken),
    canInvite ? getInvitations(session.org.id, session.accessToken) : Promise.resolve([] as Invitation[]),
  ]);
  const pending = invitations.filter((i) => i.status === "PENDING");
  const ownerCount = members.filter((m) => m.role === "OWNER").length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl text-ink">Team</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {session.org.name} · {members.length} member{members.length === 1 ? "" : "s"}
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-danger px-4 py-3 text-sm text-danger">
          {error === "forbidden" ? "You can't do that." : error}
        </p>
      )}

      <ul className="mt-6 divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
        {members.map((m) => {
          const isSelf = m.user.id === session.userId;
          const lastOwner = m.role === "OWNER" && ownerCount === 1;
          const touchable = canManage && !isSelf && (isOwner || m.role !== "OWNER") && !lastOwner;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {m.user.name ?? m.user.email ?? "Member"}
                  {isSelf && <span className="text-ink-muted"> (you)</span>}
                </p>
                {m.user.email && m.user.name && (
                  <p className="truncate text-xs text-ink-muted">{m.user.email}</p>
                )}
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[m.role]}`}>
                {m.role.toLowerCase()}
              </span>
              {touchable && (
                <>
                  <form action={changeRole} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={m.id} />
                    <select name="role" defaultValue={m.role} className="rounded border border-ink/10 bg-white px-1 py-0.5 text-xs">
                      {isOwner && <option value="OWNER">owner</option>}
                      <option value="ADMIN">admin</option>
                      <option value="MEMBER">member</option>
                    </select>
                    <button type="submit" className="text-xs text-gold-text underline">Set</button>
                  </form>
                  <form action={remove}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="text-xs text-gold-text underline">Remove</button>
                  </form>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {canInvite && (
        <>
          <section className="mt-10">
            <h2 className="font-display text-lg text-ink">Invite someone</h2>
            <form action={invite} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1 text-sm text-ink">
                Email
                <input
                  type="email"
                  name="email"
                  required
                  className="rounded-md border border-ink/10 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Role
                <select name="role" defaultValue="MEMBER" className="rounded-md border border-ink/10 bg-white px-3 py-2">
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  {isOwner && <option value="OWNER">Owner</option>}
                </select>
              </label>
              <button type="submit" className="rounded-md bg-gold px-4 py-2 text-sm text-brand">
                Send invite
              </button>
            </form>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-lg text-ink">Pending invitations</h2>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">None outstanding.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
                {pending.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ink">{inv.email}</p>
                      <p className="text-xs text-ink-muted">
                        as {inv.role.toLowerCase()} · expires {date(inv.expiresAt)}
                      </p>
                    </div>
                    <form action={resend}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="text-xs text-gold-text underline">Resend</button>
                    </form>
                    <form action={revoke}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="text-xs text-gold-text underline">Revoke</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
