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

  // Family 2: invitation acceptance (a verified invitation token, not a
  // member session). "membership.created" is already enabled above and
  // now also covers the auth auto-join producer, which emits the same
  // action string via the verified_self_membership principal kind.
  "invitation.accepted",

  // Family 3: billing and Stripe webhooks. Webhook-derived events use an
  // approved_system_job principal — signature verification is separate
  // from, and does not substitute for, tenant-PK resolution.
  "subscription.seats_synced",
  "billing.checkout_started",
  "order.paid",
  "order.cancelled",
  "order.transition_rejected",
  "subscription.status_changed",
  "invoice.paid",
  "invoice.payment_failed",

  // Family 4: the paid-order recovery cron. A local PAID row is never
  // tenant proof by itself — the resolver still requires the Order's own
  // PK-bound relation, independent of this event's payment/fulfillment
  // observation.
  "order.recovery_review_required",
]);
