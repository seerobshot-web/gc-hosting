import type { Metadata } from "next";
import { Card, Chip, PageHeader, SectionTitle, buttonPrimary, linkGold } from "@/components/ui";
import { can, getSession } from "@/lib/session";
import { getInvitations, getMembers, type Invitation, type Role } from "@/lib/api-client";
import { formatDate, initials } from "@/lib/format";
import { changeRole, invite, remove, resend, revoke } from "./actions";

export const metadata: Metadata = { title: "Team | GCH Client Portal" };

const ROLE_TONE: Record<Role, "success" | "warning" | "muted"> = {
  OWNER: "warning",
  ADMIN: "success",
  MEMBER: "muted",
};

const AVATAR_COLORS = ["bg-ministry", "bg-ember-coral", "bg-ember-orange", "bg-gold-dark"];

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
    <main className="mx-auto max-w-6xl px-6 py-8 md:px-8">
      <PageHeader
        eyebrow={session.org.name}
        title="Team"
        description={`${members.length} member${members.length === 1 ? "" : "s"}${
          pending.length ? ` · ${pending.length} invitation${pending.length === 1 ? "" : "s"} pending` : ""
        }`}
        actions={
          canInvite && (
            <a href="#invite" className={buttonPrimary}>
              Invite someone
            </a>
          )
        }
      />

      {error && (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error === "forbidden" ? "You can't do that." : error}
        </p>
      )}

      <Card className="mt-6">
        <SectionTitle>Members</SectionTitle>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              {["Member", "Role", "Joined", "Actions"].map((h) => (
                <th key={h} className="pb-2.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const isSelf = m.user.id === session.userId;
              const lastOwner = m.role === "OWNER" && ownerCount === 1;
              const touchable = canManage && !isSelf && (isOwner || m.role !== "OWNER") && !lastOwner;
              const name = m.user.name ?? m.user.email ?? "Member";
              return (
                <tr key={m.id} className="border-t border-ink/10">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold text-white ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                      >
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-ink">
                          {name}
                          {isSelf && <span className="font-normal text-ink-muted"> · you</span>}
                        </div>
                        {m.user.email && m.user.name && (
                          <div className="truncate text-[11px] text-ink-muted">{m.user.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <Chip tone={ROLE_TONE[m.role]}>{m.role.toLowerCase()}</Chip>
                  </td>
                  <td className="py-3 pr-3 font-numeric text-xs text-ink">{formatDate(m.createdAt)}</td>
                  <td className="py-3 text-right">
                    {touchable && (
                      <div className="flex items-center justify-end gap-3">
                        <form action={changeRole} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={m.id} />
                          <select
                            name="role"
                            defaultValue={m.role}
                            className="rounded-md border border-ink/10 bg-white px-1.5 py-0.5 text-xs text-ink"
                          >
                            {isOwner && <option value="OWNER">owner</option>}
                            <option value="ADMIN">admin</option>
                            <option value="MEMBER">member</option>
                          </select>
                          <button type="submit" className={linkGold}>
                            Set
                          </button>
                        </form>
                        <form action={remove}>
                          <input type="hidden" name="id" value={m.id} />
                          <button type="submit" className="font-display text-[11px] font-bold uppercase tracking-[0.06em] text-danger hover:underline">
                            Remove
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {canInvite && (
        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_340px]">
          <Card id="invite">
            <SectionTitle>Invite someone</SectionTitle>
            <form action={invite} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1.5 text-sm text-ink">
                Email
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@church.org"
                  className="h-10 rounded-lg border border-ink/10 bg-white px-3 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-ink">
                Role
                <select
                  name="role"
                  defaultValue="MEMBER"
                  className="h-10 rounded-lg border border-ink/10 bg-white px-3 text-sm text-ink"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  {isOwner && <option value="OWNER">Owner</option>}
                </select>
              </label>
              <button type="submit" className={buttonPrimary}>
                Send invite
              </button>
            </form>
            <p className="mt-2.5 text-xs text-ink-muted">
              Invites expire after 7 days. Admins can manage products and team members; only the
              workspace owner can manage billing.
            </p>
          </Card>

          <Card>
            <SectionTitle>Pending invitations</SectionTitle>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">None outstanding.</p>
            ) : (
              <ul>
                {pending.map((inv) => (
                  <li key={inv.id} className="border-t border-ink/10 py-2.5 first:border-t-0">
                    <p className="truncate text-sm font-semibold text-ink">{inv.email}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      as {inv.role.toLowerCase()} · expires <span className="font-numeric">{formatDate(inv.expiresAt)}</span>
                    </p>
                    <div className="mt-1.5 flex gap-3.5">
                      <form action={resend}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button type="submit" className={linkGold}>
                          Resend
                        </button>
                      </form>
                      <form action={revoke}>
                        <input type="hidden" name="id" value={inv.id} />
                        <button type="submit" className="font-display text-[11px] font-bold uppercase tracking-[0.06em] text-danger hover:underline">
                          Revoke
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}
