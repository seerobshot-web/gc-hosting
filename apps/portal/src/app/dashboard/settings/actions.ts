"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { can, getSession } from "@/lib/session";
import {
  addDomain,
  ApiError,
  removeDomain,
  updateMe,
  updateOrg,
  verifyDomain,
} from "@/lib/api-client";

const PAGE = "/dashboard/settings";

async function run(fn: () => Promise<unknown>, notice?: string) {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Something went wrong";
    redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(PAGE);
  redirect(notice ? `${PAGE}?notice=${encodeURIComponent(notice)}` : PAGE);
}

export async function saveProfile(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  await run(() => updateMe({ name }, session.accessToken), "Profile saved");
}

async function ownerSession() {
  const session = await getSession();
  if (!session?.org || !can(session, "org:manage")) redirect(`${PAGE}?error=forbidden`);
  return { orgId: session.org.id, token: session.accessToken };
}

export async function saveOrgName(formData: FormData) {
  const { orgId, token } = await ownerSession();
  const name = String(formData.get("name") ?? "").trim();
  await run(() => updateOrg(orgId, { name }, token), "Workspace name saved");
}

export async function addOrgDomain(formData: FormData) {
  const { orgId, token } = await ownerSession();
  const domain = String(formData.get("domain") ?? "").trim();
  await run(() => addDomain(orgId, domain, token), "Domain added — publish the TXT record, then verify");
}

export async function verifyOrgDomain(formData: FormData) {
  const { orgId, token } = await ownerSession();
  await run(() => verifyDomain(orgId, String(formData.get("id")), token), "Domain verified");
}

export async function removeOrgDomain(formData: FormData) {
  const { orgId, token } = await ownerSession();
  await run(() => removeDomain(orgId, String(formData.get("id")), token));
}

export async function setAutoJoin(formData: FormData) {
  const { orgId, token } = await ownerSession();
  const raw = String(formData.get("autoJoinDomain") ?? "");
  const autoJoinDomain = raw === "" ? null : raw;
  await run(
    () => updateOrg(orgId, { autoJoinDomain }, token),
    autoJoinDomain ? `Auto-join enabled for @${autoJoinDomain}` : "Auto-join disabled",
  );
}
