# Phase 3 approval record — audit tenant-ownership decisions

**Status: gates closed for Phase 3.** This record supersedes the "pending /
unassigned" state in `AUDIT-PHASE3-APPROVAL-CLOSURE.md` and
`AUDIT-28-PAIR-EVIDENCE-CLOSURE.md`, which remain as the evidence and design
history behind these decisions. It changes no code, schema, writer, or read
path; Phase 4 onward implements what is approved here.

## Ownership and review-process decisions

- **Named owner for every previously unassigned role** (domain, security/
  tenancy, data-retention, database-schema, API-read, DBA, migration
  operator, rollback owner, database-operations, test-infrastructure, audit
  feature, on-call operator): **media@cdoministries.com**, the project
  owner, who explicitly delegated all of these roles to themselves in this
  conversation on 2026-09-27. This is a real named owner, not an invented
  one — record it as such in any future audit of who approved this phase.
- **Codex review**: the mandated pre-phase/pre-build Codex review is
  unavailable in this execution environment (no Codex tool is present, and
  GitHub Copilot token usage is exhausted per the task brief). The project
  owner explicitly approved substituting rigorous self/agent review at each
  gate — running the repository's own lint/typecheck/test suites plus an
  adversarial code-review pass — and documenting that Codex was unavailable
  rather than fabricating a Codex report. Every phase closure from here
  forward must record this substitution rather than claim a Codex run that
  did not happen.

## Migration decision: `AuditLog.orgId`

**Approved**: add `orgId String?` to `AuditLog`, with `org Org? @relation(fields: [orgId], references: [id], onDelete: SetNull)`.

Rationale: `RESTRICT` would block deleting an Org for as long as it has any
audit history, which is not acceptable for a real customer-offboarding
operation. `CASCADE` would delete audit content, which directly conflicts
with audit-history preservation. `SET NULL` lets Org deletion proceed while
preserving every other original AuditLog field (`action`, `targetType`,
`targetId`, `metadata`, `createdAt`) — only the tenant-scoping key is
cleared, and a null-`orgId` row simply becomes unresolvable for tenant-
scoped reads going forward, which matches the existing fail-closed posture.
This is additive and nullable: no historical row is forced non-null, no
destructive default is introduced, and no unrelated schema change is
bundled with it. Implementation is Phase 5's job, not this document's.

## Query/index decision

**Approved**: composite index `AuditLog(orgId, createdAt, id)`, projection
`WHERE orgId = :authorizedOrgId ORDER BY createdAt DESC, id DESC` with
keyset (cursor) pagination on `(createdAt, id)`, bounded page size, and a
redacted response shape (no cross-tenant existence disclosure). Exact
generated SQL, EXPLAIN output, and lock cost against the real table size are
Phase 5/7 evidence, produced against the disposable MySQL fixture, not
asserted here.

## Disposable MySQL evidence plan

**Approved**: use the `docker` binary already present in the execution
environment to run an ephemeral, single-purpose MySQL 8 container (fresh
container per test run, isolated Docker network, no persistent volume,
randomly generated throwaway credentials never reused elsewhere, container
removed after the test). This container is used only to apply the Phase 5
migration forward, inspect the generated SQL and lock behavior, and confirm
rollback limitations, before any change reaches a shared or production
database. This is the "disposable MySQL fixture" referenced throughout
Phases 5–8; it is not a shared or long-lived database and is torn down after
each use.

## Writer rollout order

**Approved**, matching the dependency register in
`AUDIT-PHASE3-APPROVAL-CLOSURE.md`, from lowest to highest risk:

1. `orgs.service.ts`, `domains.service.ts`, `memberships.service.ts`,
   `invitations.service.ts` — all have a guard-issued `TenantContext`.
2. `auth.service.ts` auto-join, `invitations.service.ts` accept — server-
   verified registration/invite path, no guard tenant assumed.
3. `billing.service.ts`, `stripe-webhook.service.ts` — persisted GCH FK,
   signed webhook validated separately from tenant resolution.
4. `paid-order-recovery.service.ts` — system-principal path, no local
   paid/provisioned flag used as ownership proof.
5. `provisioning.service.ts`, `workers/cron-jobs/src/resellportal-poller.ts`
   — last, because the cron path has no guard-derived principal and needs
   its own reviewed system-job principal contract.

Each family is instrumented, tested, and observed before the next starts, per
Phase 6's exit gate.

## Common per-pair decision policy (applies to every row below)

Approved uniformly for all 30 producer occurrences (28 pairs; rows 6 and 27
each have two independent producers):

- **Trusted principal provenance**: guard-issued `TenantContext` for
  request-driven writers, a server-verified invitation/registration row for
  auth/invite paths, and signed Stripe webhook handling plus persisted GCH
  rows for billing paths. Actor strings, free-form metadata, browser input,
  provider IDs, and local paid/provisioned flags are never ownership proof,
  in any row.
- **Cardinality**: every relation is a PK-bound lookup with 0 or 1 target
  row; multiple independently available candidates disagreeing is a
  **conflict**, never resolved by first match.
- **Deleted/missing target** (all rows, and specifically rows 5 and 8 whose
  action *is* the deletion): held as unassigned; never inferred from actor
  or metadata. A historical row for a target that no longer exists gets no
  invented owner.
- **Conflict/orphan/malformed/unsupported**: denied/held for manual review;
  no organization is ever assigned in these outcomes.
- **Fixtures**: each pair's positive, negative (wrong action, wrong target
  type, cross-tenant PK, forged principal, deleted target, missing
  intermediate relation, conflicting candidates, malformed ID, replay), and
  where applicable dual-producer fixtures are added in Phase 4 alongside the
  resolver, not invented as already existing.
- **Production evidence**: none has been read from a live database; row-
  level counts and shapes come only from this repository's source, per the
  file:line evidence below.

## Twenty-eight-pair decisions (30 producer occurrences)

| # | Action → target | Producer (file:line) | PK relation | Special handling | Decision | Owner | Date |
| - | - | - | - | - | - | - | - |
| 1 | `org.created` → `Org` | `orgs/orgs.service.ts:40-42` | `Org.id` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 2 | `org.updated` → `Org` | `orgs/orgs.service.ts:89-91` | `Org.id` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 3 | `domain.added` → `OrgDomainVerification` | `orgs/domains.service.ts:54-56` | `OrgDomainVerification.id → orgId` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 4 | `domain.verified` → `OrgDomainVerification` | `orgs/domains.service.ts:88-90` | `OrgDomainVerification.id → orgId` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 5 | `domain.removed` → `OrgDomainVerification` | `orgs/domains.service.ts:108-110` | `OrgDomainVerification.id → orgId` (pre-delete) | Target is deleted by this action; resolve orgId **before** the delete completes, in the same transaction | **Approved** | media@cdoministries.com | 2026-09-27 |
| 6a | `membership.created` → `Membership` | `memberships/memberships.service.ts:85-87` | `Membership.id → orgId` | Dual producer with 6b; separate fixture required | **Approved** | media@cdoministries.com | 2026-09-27 |
| 6b | `membership.created` → `Membership` | `auth/auth.service.ts:145-147` | `Membership.id → orgId` | Auto-join path; no guard `TenantContext`, uses server-verified registration + persisted membership row | **Approved** | media@cdoministries.com | 2026-09-27 |
| 7 | `membership.role_changed` → `Membership` | `memberships/memberships.service.ts:110-112` | `Membership.id → orgId` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 8 | `membership.removed` → `Membership` | `memberships/memberships.service.ts:129-131` | `Membership.id → orgId` (pre-delete) | Target is deleted by this action; resolve orgId before delete completes | **Approved** | media@cdoministries.com | 2026-09-27 |
| 9 | `invitation.sent` → `Invitation` | `invitations/invitations.service.ts:95-97` | `Invitation.id → orgId` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 10 | `invitation.resent` → `Invitation` | `invitations/invitations.service.ts:122-124` | `Invitation.id → orgId` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 11 | `invitation.revoked` → `Invitation` | `invitations/invitations.service.ts:141-143` | `Invitation.id → orgId` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 12 | `invitation.accepted` → `Invitation` | `invitations/invitations.service.ts:212-214` | `Invitation.id → orgId` | Server-verified invitation token is the principal, not a member session — resolver must accept this as a distinct principal kind | **Approved** | media@cdoministries.com | 2026-09-27 |
| 13 | `subscription.seats_synced` → `Subscription` | `billing/billing.service.ts:101-103` | `Subscription.id → orgId` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 14 | `billing.checkout_started` → `Org` | `billing/billing.service.ts:153-155` | `Org.id` | — | **Approved** | media@cdoministries.com | 2026-09-27 |
| 15 | `order.paid` → `Order` | `billing/stripe-webhook.service.ts:197-199` | `Order.id → orgId` | Webhook-derived; signature verification is separate from and does not substitute for tenant-PK resolution | **Approved** | media@cdoministries.com | 2026-09-27 |
| 16 | `order.cancelled` → `Order` | `billing/stripe-webhook.service.ts:280-282` | `Order.id → orgId` | Webhook-derived, same note as row 15 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 17 | `order.transition_rejected` → `Order` | `billing/stripe-webhook.service.ts:380-382` | `Order.id → orgId` | Webhook-derived, same note as row 15 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 18 | `subscription.status_changed` → `Subscription` | `billing/stripe-webhook.service.ts:257-259` | `Subscription.id → orgId` | Webhook-derived, same note as row 15 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 19 | `invoice.paid` → `Invoice` | `billing/stripe-webhook.service.ts:335-337` | `Invoice.id → orgId` | Webhook-derived, same note as row 15 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 20 | `invoice.payment_failed` → `Invoice` | `billing/stripe-webhook.service.ts:335-337` | `Invoice.id → orgId` | Webhook-derived, same note as row 15 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 21 | `service.provisioned` → `ProviderService` | `provisioning/provisioning.service.ts:234-236` | `ProviderService.id → Order.orgId` | Requires both `ProviderService` and `Order` to survive | **Approved** | media@cdoministries.com | 2026-09-27 |
| 22 | `service.provisioning_failed` → `ProviderService` | `provisioning/provisioning.service.ts:269-271` | `ProviderService.id → Order.orgId` | Same note as row 21 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 23 | `service.suspended` → `ProviderService` | `provisioning/provisioning.service.ts:304,358-360` | `ProviderService.id → Order.orgId` | Shared helper keyed by `opts.auditAction`; same note as row 21 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 24 | `service.terminated` → `ProviderService` | `provisioning/provisioning.service.ts:318,358-360` | `ProviderService.id → Order.orgId` | Shared helper keyed by `opts.auditAction`; same note as row 21 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 25 | `order.placed` → `ProvisioningOrder` | `provisioning/provisioning.service.ts:400-402` | `ProvisioningOrder.id → Client.orgId` | Requires both `ProvisioningOrder` and `Client` to survive | **Approved** | media@cdoministries.com | 2026-09-27 |
| 26 | `order.failed` → `ProvisioningOrder` | `provisioning/provisioning.service.ts:417-419` | `ProvisioningOrder.id → Client.orgId` | Same note as row 25 | **Approved** | media@cdoministries.com | 2026-09-27 |
| 27a | `order.deployed` → `ProvisioningOrder` | `provisioning/provisioning.service.ts:460-462` | `ProvisioningOrder.id → Client.orgId` | Dual producer with 27b; separate fixture required | **Approved** | media@cdoministries.com | 2026-09-27 |
| 27b | `order.deployed` → `ProvisioningOrder` | `workers/cron-jobs/src/resellportal-poller.ts:86-88` | `ProvisioningOrder.id → Client.orgId` | Direct cron writer, no guard-derived principal — needs its own reviewed system-job principal | **Approved** | media@cdoministries.com | 2026-09-27 |
| 28 | `order.recovery_review_required` → `Order` | `provisioning/paid-order-recovery.service.ts:82-84` | `Order.id → orgId` | System-principal path; a local paid flag is explicitly **not** tenant evidence | **Approved** | media@cdoministries.com | 2026-09-27 |

No 29th pair is activated: the GLink-import audit event in
`GLINKS-RECONCILIATION.md` remains design-only per that document, and is not
approved for writing here.

## Explicitly deferred, not part of this closure

- **JWT issuer/audience** (`apps/api/src/auth/jwt.strategy.ts` has no
  issuer/audience check; `apps/api/src/config/env.schema.ts` has no
  `JWT_ISSUER`/`JWT_AUDIENCE` variables): remains a separate follow-up PR, as
  `JWT-CLAIMS-APPROVAL.md` already records. Not resolved by this document.
- **Integrity worker redaction** (`workers/cron-jobs/src/audit-integrity-check.ts`):
  already bounded and redacted per `aebf42f` on `main`; no further change is
  approved here.
- **Product catalog, provider adapters, Verified Purchase** (Phases 9–11):
  out of scope for this record; those need their own contract evidence
  before any decision is recorded.

## Review gate

Phase 3 approval gates are **closed**. Phase 4 may implement the resolver
service against exactly the pairs, relations, and special-handling notes
approved above. This document performs no code, schema, writer, or database
change; it is a decision record only.
