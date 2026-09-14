"use server";

import { redirect } from "next/navigation";
import { can, getSession } from "@/lib/session";
import { ApiError, createCheckoutSession, createPortalSession } from "@/lib/api-client";

/**
 * Card details never touch this app: both actions ask apps/api for a
 * Stripe-hosted URL and redirect the browser there.
 */
export async function startCheckout(formData: FormData) {
  const planId = formData.get("planId");
  const session = await getSession();
  if (!session?.org || !can(session, "billing:manage") || typeof planId !== "string") {
    redirect("/dashboard/billing?error=forbidden");
  }
  let url: string | null;
  try {
    ({ url } = await createCheckoutSession(session.org.id, planId, session.accessToken));
  } catch (err) {
    redirect(`/dashboard/billing?error=${encodeURIComponent(messageOf(err))}`);
  }
  redirect(url ?? "/dashboard/billing?error=no-url");
}

export async function openBillingPortal() {
  const session = await getSession();
  if (!session?.org || !can(session, "billing:manage")) {
    redirect("/dashboard/billing?error=forbidden");
  }
  let url: string;
  try {
    ({ url } = await createPortalSession(session.org.id, session.accessToken));
  } catch (err) {
    redirect(`/dashboard/billing?error=${encodeURIComponent(messageOf(err))}`);
  }
  redirect(url);
}

function messageOf(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}
