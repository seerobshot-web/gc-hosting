import Link from "next/link";

export default function PortalHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl text-hearth-ink">GCH Client Portal</h1>
      <p className="text-hearth-ink/80">
        Account, billing status, and provisioning are managed here. GloryLink
        clients can manage their link-in-bio page under Dashboard.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/glinks"
          className="w-fit rounded-md bg-ember-core px-4 py-2 font-medium text-cloudlight"
        >
          Go to GloryLink Dashboard
        </Link>
        <Link
          href="/dashboard/billing"
          className="w-fit rounded-md border border-ash-stone px-4 py-2 font-medium text-hearth-ink"
        >
          Billing
        </Link>
      </div>
    </main>
  );
}
