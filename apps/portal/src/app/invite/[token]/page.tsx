import { getSession } from "@/lib/session";
import { ApiError, getInvitationPreview, type InvitationPreview } from "@/lib/api-client";
import { accept } from "./actions";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const session = await getSession();

  let preview: InvitationPreview;
  try {
    preview = await getInvitationPreview(token);
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "This invitation link isn't valid.";
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Invitation</h1>
        <p className="mt-4 text-ink-sub">{message}</p>
      </main>
    );
  }

  const signedInAsInvitee = session?.email === preview.email;
  const signedInAsSomeoneElse = session && !signedInAsInvitee;

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="font-display text-2xl text-ink">Join {preview.orgName}</h1>
      <p className="mt-2 text-sm text-ink-sub">
        {preview.invitedBy} invited <strong>{preview.email}</strong> to join as{" "}
        {preview.role.toLowerCase()}.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-danger px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {signedInAsSomeoneElse ? (
        <p className="mt-6 text-sm text-ink-sub">
          You&apos;re signed in as {session.email}. Sign out and open this link again to accept it
          as {preview.email}.
        </p>
      ) : (
        <form action={accept} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="email" value={preview.email} />
          {!signedInAsInvitee && (
            <>
              {!preview.hasAccount && (
                <label className="flex flex-col gap-1 text-sm text-ink">
                  Your name
                  <input name="name" className="rounded-md border border-ink/10 px-3 py-2" />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm text-ink">
                {preview.hasAccount ? "Your password" : "Choose a password"}
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  autoComplete={preview.hasAccount ? "current-password" : "new-password"}
                  className="rounded-md border border-ink/10 px-3 py-2"
                />
              </label>
              <p className="text-xs text-ink-muted">
                {preview.hasAccount
                  ? "You already have a portal account with this email — sign in to accept."
                  : "This creates your portal account."}
              </p>
            </>
          )}
          <button type="submit" className="rounded-md bg-gold px-4 py-2 text-brand">
            Accept invitation
          </button>
        </form>
      )}
    </main>
  );
}
