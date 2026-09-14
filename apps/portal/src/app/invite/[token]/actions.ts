"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { acceptInvitation, ApiError } from "@/lib/api-client";

export async function accept(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = formData.get("password");
  const name = formData.get("name");
  const session = await getSession();

  const body: { password?: string; name?: string } = {};
  if (typeof password === "string" && password) body.password = password;
  if (typeof name === "string" && name) body.name = name;

  try {
    await acceptInvitation(token, body, session?.accessToken);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Something went wrong";
    redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(message)}`);
  }

  if (session) redirect("/dashboard/glinks");

  // New or existing account accepted with a password: establish the portal
  // session the same way /login does, then land on the dashboard.
  const email = String(formData.get("email") ?? "");
  await signIn("credentials", { email, password: body.password, redirectTo: "/dashboard/glinks" });
}
