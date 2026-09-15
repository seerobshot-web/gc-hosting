/**
 * The one permission-to-role map shared by apps/api (enforced in
 * RolesGuard) and apps/portal (used to hide affordances). Roles are a
 * closed set mirroring the Prisma `Role` enum; permissions are open — adding
 * one is a code change here, not a migration, and the api and portal can
 * never disagree about who may do what.
 */
export type Role = "OWNER" | "ADMIN" | "MEMBER";

export const ROLES: readonly Role[] = ["OWNER", "ADMIN", "MEMBER"];

const ALL: Role[] = ["OWNER", "ADMIN", "MEMBER"];
const MANAGERS: Role[] = ["OWNER", "ADMIN"];
const OWNER_ONLY: Role[] = ["OWNER"];

export const PERMISSIONS = {
  "org:read": ALL,
  "org:manage": OWNER_ONLY,
  "member:read": ALL,
  "member:invite": MANAGERS,
  "member:manage": MANAGERS,
  "client:read": ALL,
  "client:write": MANAGERS,
  "glink:read": ALL,
  "glink:write": MANAGERS,
  "provisioning:read": ALL,
  "provisioning:write": MANAGERS,
  "billing:manage": OWNER_ONLY,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function rolesFor(permission: Permission): readonly Role[] {
  return PERMISSIONS[permission];
}
