# PR #61 — audit tenant ownership design and fixture-only dry run

## Scope and inspected evidence

Reviewed `apps/api/src/audit/{audit.controller.ts,audit.service.ts,audit.controller.spec.ts,audit.module.ts}`, `apps/api/src/rbac/{roles.guard.ts,require-permission.decorator.ts}`, `apps/api/src/tenancy/tenancy.service.ts`, `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/{20260914074647_initial,20260917041128_gch_aleph_domain_model}/migration.sql`, `packages/database/prisma/migrations/migration_lock.toml`, and `packages/database/package.json`. Reviewed audit writers in `apps/api/src/{orgs/orgs.service.ts,orgs/domains.service.ts,memberships/memberships.service.ts,invitations/invitations.service.ts,auth/auth.service.ts,billing/billing.service.ts,billing/stripe-webhook.service.ts,provisioning/provisioning.service.ts,provisioning/paid-order-recovery.service.ts}` and `workers/cron-jobs/src/resellportal-poller.ts`; read `workers/cron-jobs/src/audit-integrity-check.ts`. Reviewed `apps/api/src/{config/env.schema.ts,auth/jwt.strategy.ts,main.ts}`, `apps/api/package.json`, `apps/portal/package.json`, `apps/portal/src/lib/api-client.ts`, and `apps/api/src/dashboard/dashboard.service.ts`. No portal caller of `GET /audit` was identified by repository search. Search is not proof that no caller exists outside the repository.

The current `AuditLog` table contains `actor, action, targetType, targetId, metadata, createdAt`, but no `orgId` or tenant foreign key. Its writer accepts free-form metadata. PR #60's `GET /audit` requires an explicit `orgId` query, checks live membership, then returns a safe 503 without querying audit records. No database or deployment was inspected.

## Ownership evidence by target

| Target | Candidate relational path | Qualification |
| --- | --- | --- |
| Org | `Org.id` | Direct if row exists; deleted target is orphaned. |
| Order | `Order.orgId` | FK to Org; local payment status is irrelevant. |
| ProviderService | `ProviderService.orderId → Order.orgId` | Provider identifier alone is not ownership. |
| Client | `Client.orgId` | FK to Org. |
| ProvisioningOrder | `ProvisioningOrder.clientId → Client.orgId` | Deleted resources need review. |
| GLink | `GLink.orgId`, cross-check `Client.orgId` | Conflict is ambiguous; never choose one arbitrarily. |
| Subscription / Invoice / Invitation / Membership / OrgDomainVerification | Respective `orgId` relations in schema | Verify target/action semantics and surviving row before attribution. |

`membership.removed`, `domain.removed`, and other deleted targets may be orphaned. `order.transition_rejected` omits metadata orgId but can still use surviving `Order.orgId`; free-form metadata is never sufficient. Users may belong to multiple organizations, so actor alone is never a tenant key. The legacy cron writer bypasses `AuditService` and must be accounted for before tenant-scoped writes become required.

## Classification and release boundary

`apps/api/src/audit/audit-ownership.plan.ts` defines fixture-only `AuditOwnershipEvidence`, `AuditBackfillCandidate`, `AuditTenantClassification` and a bounded `AuditBackfillDryRunReport`. Only a separately verified relational resolver may supply evidence in a future implementation. Current repository code has **no such resolver**, no database scanner, no backfill write mode, and no migration. The dry-run function reports aggregate counts over at most 1,000 supplied fixtures and always reports `writesPerformed: 0`. It never parses metadata or performs SQL.

| Class | Action |
| --- | --- |
| already_scoped | Preserve only when verified relation agrees; mismatch is ambiguous. Current schema cannot produce this in production. |
| authoritatively_attributable | Candidate for reviewed backfill only; still unreadable until written and independently checked. |
| ambiguous | Quarantine and manual review; never silently reassign. |
| orphaned | Quarantine and manual review; do not infer from actor or metadata. |
| invalid | Quarantine and manual review. |
| unsupported_event_shape | Quarantine and add an approved resolver if warranted. |

A future approved migration could add nullable `AuditLog.orgId`, an Org FK with reviewed delete behavior, and a composite `(orgId, createdAt, id)` index. Keep old rows null and unavailable. Add authoritative scoped writes for every writer, then review a read-only, bounded dry-run database resolver. Any later write mode must compare-and-set `orgId IS NULL` and verify the target relation under a transaction; disagreement quarantines the row. Batch by stable audit ID, report aggregate progress, preserve content, and never auto-run in production. Nullable-to-required is a separate decision after unsupported and orphaned rows have an approved disposition. Rollback must not delete original rows and must retain PR #60's 503; reverting PR #60 would reopen the leak.

## Security review

| Severity | File and precondition | Fix and residual risk |
| --- | --- | --- |
| High | `apps/api/src/audit/audit.controller.ts`: a legacy unscoped reader would expose cross-tenant rows. | PR #60's membership check and service 503 remain unchanged. Tests cover metadata and denial with mocks; no real HTTP/DB integration test yet. |
| Medium | `apps/api/src/audit/audit.service.ts` and audit writers: free-form metadata and deleted targets cannot establish ownership. | Fixture classifier ignores metadata; future FK resolver and reviewed backfill required. |
| Medium | `apps/api/src/auth/jwt.strategy.ts`: JWT expiry/signature checked, issuer and audience not configured; requires a signed token accepted outside its intended context. | Set issuer/audience with coordinated token issuance; outside PR #61. |
| Medium | `apps/api/src/billing/stripe-webhook.service.ts` logs order transition errors and metadata that can include payment identifiers. | Restrict future audit response projection and redaction; current read returns 503. |
| Low | `workers/cron-jobs/src/audit-integrity-check.ts`: unbounded order scan and logs order IDs when gaps exist. | Bound scans and redact identifiers in a separate worker fix. |
| Low | `apps/api/src/main.ts`: credentialed CORS uses an explicit allowlist, not a wildcard. | Keep allowlist validation; no change here. |

No new browser code, redirects, URL fetches, CSRF surface, source maps, SQL, logs, credentials, callback URLs, provider requests, or dependency/lockfile changes are added. Built Astro/Next.js output, real token replay and refresh behavior, full XSS/SSRF surface, and external operators were not dynamically inspected. The fixture code is bounded, pure and has no network or mutation path.

## Follow-up prompts (do not execute)

- **PR #62 — approved migration:** After an approved ownership map, add nullable tenant FK/index under Prisma conventions and a bounded read-only database dry run; add separately approved compare-and-set idempotent backfill, quarantine ambiguous/orphaned rows, retain original content and 503, document rollback; never run production migration.
- **PR #63 — audit reads:** Only after reviewed backfill evidence, serve rows with authoritative non-null org ownership using live membership, indexed bounded pagination, redacted fields and IDOR tests; retain safe 400/404/503; no provider or entitlement changes.
- **PR #64 — evidence registry:** Reconcile PR #59's registry; explicitly record verified, assumed, blocked and enabled state for 18 mappings, destinations, Stripe states, ResellPortal catalog/fulfillment/idempotency/retry and entitlement; deny unknown inputs.
- **PR #65 — public catalog:** Reconcile PR #58's existing `/tools`, detail pages and homepage teaser before editing; keep contact/learn-more only until all contracts approved; never expose secrets, invented prices, SKUs or links.
- **PR #66 — Stripe:** Verify signed server webhook, event idempotency, duplicate/out-of-order delivery and tenant/order scope with mock fixtures; no local-status or browser-callback eligibility and no live payment.
- **PR #67 — ResellPortal:** Use approved contracts or fixtures for auth/schema/timeout/retry/idempotency/unknown-state behavior; leave absent contracts as a disabled adapter and never invent provider values.
- **PR #68 — readiness:** Require independently verified product, destination, Stripe and ResellPortal observations, scoped correlation and evidence refs, approved entitlement policy and disabled-by-default flag; pure deterministic tests only, no grant.

Every future provider adapter must document auth, schema validation, timeouts, retry rules, caching, idempotency, unknown states, correlation, redaction, safe errors, SSRF controls, fixtures and evidence source. No pinned generated `@hostinger/sdk` 1.54.1 method surface was inspected, so Hostinger SDK work remains blocked.

## Copilot handoff

In `seerobshot-web/gc-hosting`, preserve PR #60's `GET /audit` 400/404/503 and zero-row behavior. AuditLog currently lacks orgId. Review every writer and relational ownership path before implementing an additive tenant-key migration. Use only FK-backed relations; quarantine ambiguity and deleted targets. Begin with bounded aggregate-only dry-run and no writes; require approval before migration/backfill. Keep the existing 18-tool catalog and Phase 3 purchase/fulfillment disabled. Run build, lint, typecheck, tests, audit and CodeQL; no provider calls, payment actions, deployment, production database migration or entitlements.
