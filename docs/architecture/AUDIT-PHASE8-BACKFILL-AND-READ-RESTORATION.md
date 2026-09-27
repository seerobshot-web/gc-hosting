# Phase 8 — controlled backfill and audit-read restoration

**Status: implemented, unit-tested, and verified against a real disposable
database. Not run against, and no code path here touches, any shared or
production database.**

## Controlled backfill

- `apps/api/src/audit/audit-ownership-backfill.ts`: bounded, cursor-paginated
  (same shape as Phase 7's scanner: `AUDIT_OWNERSHIP_BACKFILL_BATCH_SIZE =
  200`, `AUDIT_OWNERSHIP_BACKFILL_MAX_ROWS = 5,000`), reusing the same
  `classifyAuditOwnership`. Writes **only** rows classified
  `authoritatively_attributable` (exactly one deterministic relation
  candidate). Conflicts, orphans, unsupported, invalid, and unavailable rows
  are left untouched every time, for separate review — never guessed at.
- `apps/api/src/audit/audit-ownership-backfill.service.ts`: the real write
  is `prisma.auditLog.updateMany({ where: { id, orgId: null }, data: {
  orgId } })` — `updateMany`, not `update`, specifically so the `orgId:
  null` guard is enforced atomically at the database level. `count === 0`
  means a concurrent writer (a live Phase 6 write, or an overlapping
  backfill run) already set that row; it is counted as `skippedRace`, never
  treated as an error, and never overwritten.
- Registered as `AuditOwnershipBackfillService` in `AuditModule`. **Not**
  scheduled, **not** exposed through any route. Running it against a real
  environment is a separate, explicitly approved step — after that
  environment's own Phase 7 dry-run report has been reviewed, per that
  phase's review gate.

### Real-database verification (not mocks)

Restarted the same disposable, ephemeral, apt-installed local MySQL 8.0.46
instance used for Phase 5 (see that phase's evidence for why apt instead of
Docker), applied all 7 migrations including the Phase 5 audit-scope one,
then ran two standalone scripts directly against it (not through the unit
test mocks) to prove the properties a mock cannot fully prove:

1. **Guard correctness under a real race.** Inserted an Org and an
   AuditLog row citing it. A guarded `updateMany` with `{id, orgId: null}`
   applied (`count: 1`). A second guarded write attempting to overwrite it
   with a different org affected **zero rows** — the guard held — and the
   row's `orgId` remained the first value, never the second. Then deleted
   the Org: the *already-backfilled* row still correctly went to `orgId:
   null` via the Phase 5 `SET NULL` FK behavior, proving backfill and the
   FK behavior compose correctly.
2. **Read isolation under real cross-tenant data.** Inserted 5 rows for
   `org-read-a`, 5 for `org-read-b` (interleaved timestamps), and one
   legacy null-orgId row. A keyset-paginated query scoped to `org-read-a`
   returned exactly its 5 rows across two pages, in the correct
   newest-first order, with no duplicates and no row from `org-read-b`; a
   query scoped to `org-read-b` never returned an `org-read-a` row; the
   legacy null row appeared in neither.

Both scripts and the disposable database were deleted/torn down
immediately after (`DROP DATABASE`, `DROP USER`, `mysqladmin shutdown`,
confirmed by a subsequent failed connection). Nothing persists from this
verification.

## Audit-read restoration

- `apps/api/src/audit/audit-read-cursor.ts`: opaque keyset cursor
  (`base64url` of `createdAt|id`) — encodes nothing but those two fields,
  never `orgId` or any value a caller could use to probe another tenant.
  Malformed input decodes to `null`, which the service turns into a 400,
  never a silent "start from the beginning."
- `apps/api/src/audit/dto.ts`: `AuditListQueryDto` (`cursor?`, `limit?`,
  bounded to `AUDIT_LIST_MAX_LIMIT = 100`, default `AUDIT_LIST_DEFAULT_LIMIT
  = 50`).
- `AuditService.recentForOrg` now runs the approved query design exactly:
  `WHERE orgId = :orgId [AND keyset predicate] ORDER BY createdAt DESC, id
  DESC LIMIT :limit+1`, using the Phase 5 composite index. `orgId` comes
  only from the guard-verified `TenantContext` the controller already
  requires (`@RequirePermission("org:read", "org")`) — never from a request
  body or query parameter — so a row belonging to a different org can never
  be selected by construction, and a still-null-orgId row (not yet resolved
  or backfilled) is simply excluded, never surfaced as ambiguous or
  cross-tenant.
- `apps/api/src/audit/audit-read-rollout.ts`: `AUDIT_READ_RESTORATION_ENABLED`
  — the reversible gate. Set it back to `false` to instantly restore the
  pre-Phase-8 fail-closed 503, the same lever pattern as the Phase 6 writer
  rollout allowlist.

## What was verified (automated)

- `audit-read-cursor.spec.ts`: round-trip encoding, that no value beyond
  createdAt/id is ever encoded, and rejection of malformed/empty input.
- `audit.controller.spec.ts` (extended): the query is always scoped to the
  caller's own `orgId`; a fabricated scenario proves org B's query can never
  return an org A row; `nextCursor` is issued only when a further page
  exists and is accepted back correctly; a malformed cursor is rejected
  with 400 before any query runs; the page size is bounded regardless of
  what a caller requests; stored JSON metadata round-trips to an object;
  a real encoded cursor round-trips into a valid keyset predicate.
- `audit-ownership-backfill.spec.ts` / `.service.spec.ts`: bucketing
  matches the scanner's semantics exactly (only deterministic rows are
  written), a guard miss counts as `skippedRace` not `backfilled`,
  pagination/capping, cursor/batch validation, and idempotency (re-running
  after every row is backfilled examines nothing new — because the reader
  itself only ever selects `orgId IS NULL` rows).
- Full workspace `pnpm build && pnpm lint && pnpm typecheck && pnpm test`
  green (190 tests, up from 173).

## What was not done, and why

- **No real backfill run and no real production read enablement.** No
  staging or production `DATABASE_URL` exists in this environment. The
  code is implemented, unit-tested, and verified against real (disposable)
  data as described above; actually running the backfill against, and
  enabling reads against, a shared environment's real historical rows is
  the operator's decision at deploy time, using the two reversible gates
  (`AUDIT_TENANT_RESOLUTION_ENABLED_ACTIONS` already covers writers;
  `AUDIT_READ_RESTORATION_ENABLED` covers this phase's read).
- **No performance/EXPLAIN evidence against a production-sized table.**
  The disposable database used here has at most a few dozen rows; real
  query-plan and lock-duration evidence needs the real table's size, which
  isn't available here. Recorded as an open item for the environment that
  actually runs this, not silently skipped.

## Review gate

Before enabling this in any shared environment: run the Phase 7 scanner,
review its report, run this phase's backfill once against that same
environment and confirm its summary (`backfilled` matches the scanner's
`resolved` count from immediately prior; `conflict`/`orphaned`/etc. are
left for manual review, never auto-resolved), then flip
`AUDIT_READ_RESTORATION_ENABLED` only after that backfill's result has been
reviewed by the named Phase 3 owner. This document does not constitute
that review, and does not itself enable anything in a shared environment.
