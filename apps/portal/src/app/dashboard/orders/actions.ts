"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
export async function startPrepaidCheckout(form: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const response = await fetch(
    `${process.env.GCH_API_URL ?? "http://localhost:3333"}/commerce/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        dealId: String(form.get("dealId") ?? ""),
        requestKey: String(form.get("requestKey") ?? ""),
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) redirect("/dashboard/orders?error=unavailable");
  const result = (await response.json()) as { url?: string };
  // Never send the browser to an arbitrary URL returned by an upstream service.
  if (!result.url || new URL(result.url).origin !== "https://checkout.stripe.com")
    redirect("/dashboard/orders?error=unavailable");
  redirect(result.url);
}
export async function savePrepaidIntake(form: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(form.get("orderId") ?? "");
  const response = await fetch(
    `${process.env.GCH_API_URL ?? "http://localhost:3333"}/commerce/orders/${encodeURIComponent(id)}/intake`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        primaryDomain: form.get("primaryDomain"),
        cpanelUsername: form.get("cpanelUsername"),
      }),
      cache: "no-store",
    },
  );
  redirect(response.ok ? "/dashboard/orders" : "/dashboard/orders?error=intake");
}

export async function uploadBrandIntake(form: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 512 * 1024 || !file.size)
    redirect("/dashboard/orders?error=intake");
  const id = String(form.get("orderId") ?? "");
  const response = await fetch(
    `${process.env.GCH_API_URL ?? "http://localhost:3333"}/commerce/orders/${encodeURIComponent(id)}/brand-intake`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ base64: Buffer.from(await file.arrayBuffer()).toString("base64") }),
      cache: "no-store",
    },
  );
  redirect(response.ok ? "/dashboard/orders" : "/dashboard/orders?error=intake");
}
