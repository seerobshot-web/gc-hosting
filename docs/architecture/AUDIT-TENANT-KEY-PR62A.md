# PR #62A — audit tenant-key migration approval package

**Status: BLOCKED DESIGN; approval requested.** This document changes no Prisma model, migration, audit reader, writer, scanner or runtime. It grants no approval to apply DDL, backfill, or restore reads. Current behavior remains `GET /audit`: absent org scope 400; nonmember 404; authorized member 503 and zero audit-row reads. PR #61 is merged; its classifier accepts fixtures only.

## Verified files and scope

Read from current main: `apps/api/src/audit/{audit-ownership.plan.ts,audit-ownership.plan.spec.ts,audit.controller.ts,audit.controller.spec.ts,audit.service.ts,audit.module.ts}`, `docs/architecture/{AUDIT-OWNERSHIP-PR61.md,AUDIT-READ-TENANT-ISOLATION.md,GLINKS-RECONCILIATION.md}`, `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/migration_lock.toml`, all six `packages/database/prisma/migrations/*/migration.sql`, `packages/database/scripts/backfill-identity.ts`, `packages/database/src/index.ts`, `packages/database/package.json`, `apps/api/package.json`, root `package.json`, `.github/workflows/{ci.yml,codeql.yml}`, `apps/api/src/rbac/roles.guard.ts`, `apps/api/src/tenancy/tenancy.service.ts`, `apps/api/src/{auth/jwt.strategy.ts,auth/auth.service.ts,config/env.schema.ts,main.ts}`, `workers/cron-jobs/{package.json,src/audit-integrity-check.ts,src/resellportal-poller.ts}`, and audit writers `apps/api/src/{orgs/orgs.service.ts,orgs/domains.service.ts,memberships/memberships.service.ts,invitations/invitations.service.ts,billing/billing.service.ts,billing/stripe-webhook.service.ts,provisioning/provisioning.service.ts,provisioning/paid-order-recovery.service.ts}`. PR #61 metadata confirms merged status. Repository-tree inspection found no `docs/architecture/12-deployment-runbook.md` (a link in `docs/architecture/README.md` points to this missing file); no live database inventory, backup/restore drill, migration runtime, table size or lock timing was supplied. A repository-tree scan is not proof of external infrastructure.

The schema has `Org.id` as primary key; `AuditLog` has `id, actor, action, targetType, targetId, metadata, createdAt` and indexes on target/actor/time but no `orgId`. MySQL migration lock is `provider = "mysql"`. Historical migrations use both RESTRICT and SET NULL on other relations, so neither delete action is implied for AuditLog. `20260914094923_add_org_slug` uses a two-phase nullable-to-required migration **with a write**; this precedent does not approve an audit rewrite. `backfill-identity.ts` is an unbounded, write-capable identity script and must not be copied as an audit scanner. No separate audit repository exists: `AuditService` writes directly through Prisma; its read method throws 503.

## Ownership decision matrix

All candidates below are GCH database relations, never metadata or an external ID. For every listed target: a malformed ID/action/type is `invalid`; an unknown target is `unsupported_event_shape`; a nullable audit scope agreeing with every surviving candidate is `already_scoped`; a scope disagreeing with one is `ambiguous`; a unique surviving approved candidate on an unscoped row is `authoritatively_attributable`; missing proof is `orphaned` only after the event/target mapping is approved. Until that approval, unknown semantics remain `unsupported_event_shape`. Never substitute actor, email/domain, browser input, payment state or free-form metadata.

| Target / observed event semantics | Candidate authoritative relation | After target deletion / missing relation | Conflicting relations | Approval needed |
| --- | --- | --- | --- | --- |
| Org: `org.created`, `org.updated`, `billing.checkout_started` | Existing `Org.id`; not the metadata slug or session ID | No surviving target proof: orphaned, pending event review | Existing audit key vs target: ambiguous | Approve handling deleted org and checkout event. |
| Order: `order.paid`, `order.cancelled`, `order.transition_rejected`, `order.recovery_review_required`, provisioning transitions | Existing `Order.orgId → Org.id` | Orphaned if order absent; local PAID is not proof of tenant or payment | Audit key vs FK: ambiguous | Review action/target matrix, deleted orders and historical semantics. |
| ProviderService: provisioning lifecycle actions | Existing `ProviderService.orderId → Order.orgId` | Orphaned if service/order absent | Audit key vs FK: ambiguous | Confirm every emitted action and lifecycle meaning; no provider ID inference. |
| Client: any audited Client target | Existing `Client.orgId → Org.id` | Orphaned if client absent | Audit key vs FK: ambiguous | No Client-target action confirmed in inspected writers; mark unsupported until observed/approved. |
| ProvisioningOrder: legacy `order.deployed` and provisioning lifecycle actions | Existing `ProvisioningOrder.clientId → Client.orgId` | Orphaned if either target/client absent | Audit key vs FK: ambiguous | Review cron and API action semantics, especially deleted clients. |
| GLink: target supported by PR #61 classifier; imported event exists only in design document | Existing `GLink.orgId` AND `GLink.clientId → Client.orgId` | Orphaned on missing link; missing client makes proof incomplete: manual review | Either path disagrees: ambiguous; never choose first | Confirm actual GLink audit events and missing-client policy; design-only importer is not an active writer. |
| Subscription: `subscription.status_changed`, `subscription.seats_synced` | Existing `Subscription.orgId → Org.id` | Orphaned if target absent | Audit key vs FK: ambiguous | Approve event mapping and lifecycle history. |
| Invoice: `invoice.paid`, `invoice.payment_failed` | Existing `Invoice.orgId → Org.id` | Orphaned if target absent | Audit key vs FK: ambiguous | Approve event mapping; external invoice ID cannot determine org. |
| Invitation: sent, resent, revoked, accepted | Existing `Invitation.orgId → Org.id` | Orphaned if target absent | Audit key vs FK: ambiguous | Confirm deleted invitation semantics. |
| Membership: created, role_changed, removed | Existing `Membership.orgId → Org.id` | Removed target can be deleted: orphaned without surviving FK | Audit key vs FK: ambiguous | Approve handling removed membership; user may have multiple orgs. |
| OrgDomainVerification: added, verified, removed | Existing `OrgDomainVerification.orgId → Org.id` | Removed target is deleted: orphaned without surviving FK | Audit key vs FK: ambiguous | Approve handling removed domain; metadata domain is not ownership. |
| Other / malformed target-action pair | No approved relation | Unsupported event shape, or invalid if required fields malformed | Never assign | Complete action inventory against actual data and approve shape map. |

The matrix distinguishes schema paths from approval of historic event semantics. Even a valid relation is not an instruction to backfill. A row already scoped to an org with no surviving target requires separate review; never silently treat the absent relation as independent confirmation.

## Migration decision record: blocked

- **Design candidate:** nullable `AuditLog.orgId` referencing `Org.id` is structurally feasible, and would preserve existing rows and unchanged writers; *approval to generate DDL is BLOCKED*.
- **Delete action:** RESTRICT could prevent deletion of referenced Org rows; SET NULL could erase a tenant key and break future reads. Existing migrations demonstrate both on different models. No approved audit retention/delete policy selects either. Deletion behavior and FK constraint must be reviewed explicitly.
- **Writer transition:** future authoritative scope should be supplied by a trusted target row or tenant guard, never actor or metadata; writers with no proof retain null until reviewed. Cover `AuditService` and the direct `resellportal-poller` write. Do not change them here.
- **Nullability:** keep nullable through migration, classification, reviewed backfill and read rollout. Any later NOT NULL change is separate and may be impossible without an approved policy for orphaned legacy rows.
- **Index:** PR #61 projects `(orgId, createdAt, id)`; PR #60 does not execute scoped reads. No index approval yet. Obtain a reviewed future `WHERE orgId = ? ORDER BY createdAt DESC, id DESC` pagination query, MySQL explain on safe representative data, and operational DDL review. An ID-only scanner uses existing primary key, so it does not itself justify this index.
- **Rollback:** retain PR #60's 503; roll back application changes independently. DDL rollback plan must account for newly written org keys and MySQL DDL behavior; do not drop populated ownership data or original audit fields on an automatic rollback. Backups/recovery and forward-fix procedure need approval.
- **Preservation:** ambiguous, missing, invalid, unsupported and unscoped rows stay untouched and inaccessible. No quarantine table or write mode is approved.
- **Gate:** schema owner, security/tenancy owner and database operator must approve event matrix, FK delete action, index query, live database inventory, backup/recovery evidence, MySQL version and DDL lock/runtime budget before any Prisma/SQL migration draft or execution. This document does not substitute for that approval.

## Proposed database dry-run (not implemented)

Future proposal using `@gch/database` Prisma client, following the standalone `tsx` script convention: `pnpm --filter @gch/database exec tsx scripts/audit-tenant-dry-run.ts --mode=dry_run --batch-size=100 --max-rows=1000`. **This command is illustrative and does not exist or run.** Require literal `dry_run`; reject missing mode, unknown flags, negative/oversized bounds and any `write` switch. Proposed hard limits: batch 1–100, total 1–1000; seek by `AuditLog.id > cursor`, `orderBy id asc`, `take <= min(batchSize, remaining)`; select only `id, action, targetType, targetId` and future `orgId`. Keep IDs in process for FK lookups and cursor but exclude them, metadata, actor, payment instruments, email and provider fields from output/errors. Avoid `count()` or any unbounded table scan. Before resolving any candidate, validate the exact approved `(action, targetType)` pair against a reviewed allowlist. An unapproved pair (including `order.paid` targeting `Org` or an arbitrary action targeting `Order`) is `unsupported_event_shape` without ownership resolution; malformed required fields are `invalid`. PR #61's broad supported-target check is insufficient by itself. Only for a validated pair fetch FK-backed target keys and org paths; check both GLink relations. Then reuse PR #61 `classifyAuditOwnership` and aggregate report, never pass metadata. Design public output as counts with `writesPerformed: 0`; do not include raw cursors in ordinary logs. A continuation reference needs separate logging/privacy approval.

A single dry run is best effort under concurrent writes: each row is visited at most once by stable ID, but relation changes between reads may change classifications; do not claim snapshot consistency or cross-run determinism without an approved repeatable-read snapshot strategy and its lock/cost review. Concurrent scanners are both read-only and may duplicate read load; impose operator scheduling and concurrency limit. Require configurable, bounded wall time/cancellation with client disconnect in `finally`, abort before next batch, bounded per-query timeout backed by verified Prisma/MySQL mechanism, safe aggregate-only errors, and no mutation on failure. An unchanged *database snapshot* should produce the same counts and page order. An eventual writer belongs in a separate approved PR; the proposed type allows only `mode: "dry_run"` and report literal `writesPerformed: 0`.

```ts
// Proposed design only; reuse existing AuditTenantClassification and fixture report.
interface AuditDatabaseDryRunOptions {
  mode: "dry_run";
  batchSize: number; // 1..100 proposed; approve operational cap
  maxRows: number;   // 1..1000 proposed; approve operational cap
  cursor?: string;   // internal opaque resume handling pending privacy review
}
interface AuditDatabaseDryRunReport {
  examined: number;
  alreadyScoped: number;
  attributable: number;
  ambiguous: number;
  orphaned: number;
  invalid: number;
  unsupported: number;
  manualReviewRequired: number;
  writesPerformed: 0;
}
```

No public route is proposed. `GET /audit` remains 400/404/503 and zero audit-row reads. No operator bypass.

## Test plan, not executed

Future `apps/api/src/audit/audit-database-dry-run.spec.ts` with a read-only Prisma fake and fixture IDs: missing/deleted target, mismatched GLink orgs, malformed audit fields, unsupported event/target, unchanged repeated run, batch=0/101, maxRows=0/1001, stable ID cursor without overlap, concurrent dry runs, fake write methods that throw and receive zero calls, metadata/actor/email spoofing, existing scope mismatch, tenant isolation and aggregate JSON without IDs, provider identifiers, payments or secrets. Future migration tests: nullable legacy rows survive; existing writer succeeds; no data fields lost; selected FK delete behavior and index match approval and query plan; staged rollback retains original content. Retain `apps/api/src/audit/audit.controller.spec.ts` 400/404/503 and zero reads and `audit-ownership.plan.spec.ts` fixtures.

Commands to run **after implementation**, not run in PR #62A: `pnpm install --frozen-lockfile`; `pnpm --filter @gch/database generate`; `pnpm --filter @gch/api test`; `pnpm build`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm audit --prod --audit-level=high`; CodeQL workflow `.github/workflows/codeql.yml` if enabled. Never use production DB for fixture tests. CI workflow `.github/workflows/ci.yml` runs these workspace gates on pull requests.

## Separate security follow-ups

| Severity | File, exploit precondition | Recommendation / test / residual |
| --- | --- | --- |
| Medium | `apps/api/src/auth/jwt.strategy.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/config/env.schema.ts`: a token signed by the same secret in another context could be accepted; issuer/audience are neither issued nor required in inspected code. Signature and expiry are checked. | Separate token-policy approval for concrete issuer and audience, issuance/verification tests including wrong claims; do not invent values. Existing short-lived access tokens remain replayable until expiry; refresh revocation is DB-backed, and concurrent refresh rotation deserves separate tests. |
| Medium | `workers/cron-jobs/src/audit-integrity-check.ts`: deployed order query has no take/cursor and gap logs include order IDs; worker runs with DB/log access. | Separate worker PR: bounded cursor, aggregate/redacted logs, failure/retry policy, test empty/large/error batches; query cost and external log exposure remain unmeasured. |

Security scope of this documentation-only PR: no browser or server source changes, tokens, URLs, SQL, API routes, dependencies, source maps or lockfile edits. No new SSRF, XSS, CSRF, CORS, unsafe redirect, injection, IDOR or provider call path is introduced. Existing `main.ts` parses an explicit CORS allowlist; `roles.guard.ts` + `tenancy.service.ts` enforce live membership, while `audit.service.ts` refuses reads. Residual production risks in existing billing/provider/redirect/browser and operational logging paths require separate scoped review; they were not dynamically tested. Future operator reports must escape any rendered text, omit target IDs and avoid raw exception logging; future scripts must not accept arbitrary network URLs or SQL fragments.

## Release sequence and approval checklist

1. Approve this matrix's event semantics, deleted-target policy, dual GLink resolution, and permitted scoped-write provenance. **Rollback:** doc revision only.
2. Approve FK delete policy, future scoped query/index, DB size/version, backup/restore test, DDL lock/time budget and migration execution owner. **Rollback:** doc revision only.
3. In separate PR #62B, draft additive nullable schema/migration for review only; no production apply. Preserve old writer compatibility and PR #60 503. **Rollback:** revert draft before execution.
4. In later separately approved work, implement fixture-tested bounded read-only DB scanner; review results, no production run without operational approval. **Rollback:** remove scanner; no rows changed.
5. Before the **final** approved backfill, deploy and verify authoritative scoped writes from every active audit producer, including `AuditService` callers and the direct `resellportal-poller` writer. Run tests proving new events have the correct tenant key or remain unavailable without proof. Record a cutover watermark and monitor new null-scope rows. **Rollback:** retain 503 while correcting writers; never expose unscoped rows.
6. With writers verified, execute only the separately approved conditional backfill in the approved environment after backup/review. Run an explicit post-cutover catch-up scan through a reviewed watermark so rows created during the transition are assessed. Independently reconcile null-scope rows before declaring backfill complete; preserve ambiguous rows as inaccessible. **Rollback:** forward repair preserving original audit content, under separately approved procedure.
7. Only after independent backfill and catch-up review, verified scoped-writer cutover, and live membership/IDOR tests may a later PR restore tenant-scoped reads; retain 503 until then. **Rollback:** restore 503, never unscoped reads.

**Side effects:** this document creates no migration or schema edit, no database read/write or backfill, no Stripe/Hostinger/ResellPortal call, payment action, deployment, fulfillment, provisioning or entitlement change. Provider/product/Stripe/entitlement contracts remain unapproved and out of scope.
