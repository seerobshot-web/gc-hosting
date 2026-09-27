/**
 * Reversible per-action rollout gate for Phase 6
 * (see AUDIT-PHASE3-APPROVAL-RECORD.md's writer rollout order). An action
 * listed here has orgId resolution attempted whenever its caller supplies a
 * principal; removing an entry (or emptying this set entirely) instantly
 * reverts that action to pre-Phase-6 behavior — orgId always null — with no
 * other code change and no redeploy of the call sites themselves.
 *
 * Extended one writer family at a time, in the approved order, never all at
 * once: each addition is its own reviewed commit.
 */
export const AUDIT_TENANT_RESOLUTION_ENABLED_ACTIONS: ReadonlySet<string> = new Set([
  // Family 1: orgs, domains, memberships, invitations (all but accept) —
  // every one of these either has a guard-issued TenantContext or (for
  // org.created / the auth auto-join membership.created — the latter is
  // Family 2) a just-created Membership row to cite directly.
  "org.created",
  "org.updated",
  "domain.added",
  "domain.verified",
  "domain.removed",
  "membership.created",
  "membership.role_changed",
  "membership.removed",
  "invitation.sent",
  "invitation.resent",
  "invitation.revoked",
]);
