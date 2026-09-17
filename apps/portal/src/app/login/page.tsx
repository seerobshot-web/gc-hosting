"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setSubmitting(false);
    if (result?.error) {
      setError("We couldn't sign you in. Check your email and password and try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const input =
    "h-11 rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-8 shadow-card-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-gold font-display text-[11px] font-extrabold text-brand">
              GC
            </span>
            <span className="font-display text-xs font-extrabold tracking-[0.06em] text-ink">
              GLORY CLOUD HOSTS
            </span>
          </div>
          <div>
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.1em] text-gold-text">
              Built for ministry &#10022;
            </div>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold uppercase text-ink">Sign in</h1>
            <p className="mt-1 text-sm text-ink-sub">
              Your client portal for hosting, billing, and your team.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-ink">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-ink">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={input}
              />
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-full bg-gold text-sm font-semibold text-brand shadow-gold transition hover:bg-gold-dark disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-center text-xs text-ink-muted">
            Invited by a workspace admin? Use the link in your invite email.
          </p>
        </div>
      </section>

      <aside className="hidden w-[46%] max-w-[560px] flex-col justify-between bg-sacred-ember p-12 text-brand lg:flex">
        <div className="font-display text-[10px] font-bold uppercase tracking-[0.1em] text-brand/70">
          Enterprise infrastructure &middot; Ministry-focused support
        </div>
        <div>
          <h2 className="font-display text-4xl font-extrabold uppercase leading-[1.1]">
            Hosting that walks with your church.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-brand/80">
            Free SSL on every site. Free migration. Real people, ready when you need them.
          </p>
        </div>
        <div className="font-display text-[10px] font-bold uppercase tracking-[0.08em] text-brand/70">
          gloryhosts.cloud
        </div>
      </aside>
    </main>
  );
}
