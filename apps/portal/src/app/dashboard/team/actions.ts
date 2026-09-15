"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { can, getSession } from "@/lib/session";
import {
  ApiError,
  changeMemberRole,
  createInvitation,
  removeMember,
  resendInvitation,
  revokeInvitation,
  type Role,
} from "@/lib/api-client";

const PAGE = "/dashboard/team";
const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];

async function guarded(
  permission: "member:invite" | "member:manage",
  fn: (orgId: string, token: string) => Promise<void>,
) {
  const session = await getSession();
  if (!session?.org || !can(session, permission)) redirect(`${PAGE}?error=forbidden`);
  try {
    await fn(session.org.id, session.accessToken);
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "Something went wrong";
    redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(PAGE);
  redirect(PAGE);
}

function roleFrom(formData: FormData): Role {
  const role = formData.get("role");
  return ROLES.includes(role as Role) ? (role as Role) : "MEMBER";
}

export async function invite(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const role = roleFrom(formData);
  await guarded("member:invite", (orgId, t) => createInvitation(orgId, email, role, t).then(() => {}));
}

export async function resend(formData: FormData) {
  const id = String(formData.get("id"));
  await guarded("member:invite", (orgId, t) => resendInvitation(orgId, id, t).then(() => {}));
}

export async function revoke(formData: FormData) {
  const id = String(formData.get("id"));
  await guarded("member:invite", (orgId, t) => revokeInvitation(orgId, id, t));
}

export async function changeRole(formData: FormData) {
  const id = String(formData.get("id"));
  const role = roleFrom(formData);
  await guarded("member:manage", (orgId, t) => changeMemberRole(orgId, id, role, t).then(() => {}));
}

export async function remove(formData: FormData) {
  const id = String(formData.get("id"));
  await guarded("member:manage", (orgId, t) => removeMember(orgId, id, t));
}
