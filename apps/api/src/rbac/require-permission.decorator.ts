import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@gch/permissions";

export const PERMISSION_KEY = "requiredPermission";

/**
 * Where RolesGuard finds the org a request is about:
 *  - "org":    `orgId` in route params, body, or query
 *  - "client": `clientId` in route params, body, or query → Client.orgId
 *  - "glink":  `id` route param → GLink.orgId
 */
export type TenantScope = "org" | "client" | "glink";

export interface PermissionRequirement {
  permission: Permission;
  scope: TenantScope;
}

export const RequirePermission = (permission: Permission, scope: TenantScope = "org") =>
  SetMetadata<string, PermissionRequirement>(PERMISSION_KEY, { permission, scope });
