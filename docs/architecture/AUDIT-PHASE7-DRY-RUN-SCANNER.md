# Phase 7 — bounded dry-run scanner

**Status: implemented and unit-tested; not yet run against any real
database.** This phase adds the capability only. Running it against a real
`AuditLog` table (staging or production) and reviewing the resulting report
is a separate, explicitly gated step that must happen before any Phase 8
backfill — this document does not authorize that step.

## What was built

- `apps/api/src/audit/audit-ownership-relations.ts`: the nine PK-bound
  relation lookups, extracted out of `AuditTenantResolverService` (Phase 4)
  so the live resolver and this offline scanner share one implementation
  instead of two copies that could drift.
- `apps/api/src/audit/audit-ownership-scan.ts`: the pure, bounded,
  cursor-paginated classifier — `AUDIT_OWNERSHIP_SCAN_BATCH_SIZE = 200`,
  `AUDIT_OWNERSHIP_SCAN_MAX_ROWS = 5,000` per invocation. Mirrors the
  existing `workers/cron-jobs/src/audit-integrity-scan.ts` pattern already
  proven in this codebase: a reader interface, a strictly-advancing `id`
  cursor, a capped read that reports `incomplete: true` rather than silently
  looping forever, and zero writes (`writesPerformed` is always the literal
  `0`). Reuses the already-tested pure `classifyAuditOwnership` (from Phase
  3's `audit-ownership.plan.ts`) for the actual classification logic, so the
  bucket semantics (resolved / conflict / orphaned / unsupported / invalid /
  unavailable / already-scoped) are identical to what that module's fixture
  tests already cover.
- `apps/api/src/audit/audit-ownership-scan.service.ts`: real-Prisma wiring —
  `WHERE orgId IS NULL ORDER BY id ASC`, using the new Phase 5 composite
  index (`(orgId, createdAt, id)`, which MySQL can use for an `orgId IS
  NULL` predicate since InnoDB indexes NULL values). Logs only the
  aggregate summary, never a row id, target id, action, or org id.
- Registered as `AuditOwnershipScanService` in `AuditModule`. **Not**
  scheduled (no `@Cron`) and **not** exposed through any route — Phase 7
  is the capability, not the decision to run it.

## Restartability, honestly stated

There is no persisted-cursor "resume mid-scan" API. Every invocation
re-derives its classification from the current `orgId IS NULL` set, which is
what makes repeated runs safe: there is no state to get out of sync, and no
write to ever duplicate. A capped run that reports `incomplete: true` is
simply re-run from scratch later (after Phase 6 writers have had time to
narrow the null set, or on a schedule) — it is not designed to pick up
"row 5,001" specifically. This is deliberately simpler than a true
incremental resume, appropriate for a reporting tool bounded to 5,000 rows
per call rather than a one-time migration.

## What was verified

- `audit-ownership-scan.spec.ts`: empty run, correct bucketing for every
  classification (including a genuinely unsupported target type and a
  resolver-unavailable row), pagination across the batch-size boundary with
  the bounded-lookahead completeness check, cursor/batch validation errors,
  idempotency of two full re-scans over unchanged data, and that the
  returned summary contains no per-row identifiers.
- `audit-ownership-scan.service.spec.ts`: the real-Prisma wiring queries
  only `orgId: null` rows (never the whole table) and classifies via the
  shared relation lookups.
- Full workspace `pnpm build && pnpm lint && pnpm typecheck && pnpm test`
  green (173 tests, up from 166).

## What was not done, and why

- **Not run against a real database.** No staging or production
  `DATABASE_URL` exists in this environment, and running it against one is
  exactly the gated step this phase's exit criteria reserve for a separate,
  explicitly approved action — not something to do inside an implementation
  PR.
- **No lock-budget or latency-threshold instrumentation beyond the row
  cap.** The approved plan calls for stopping "on error-rate, latency, lock,
  or conflict thresholds." The row cap (5,000) and per-call bounded batch
  (200) are implemented and tested; wall-clock/error-rate circuit breakers
  depend on real operational data (actual table size, actual query latency)
  that isn't available here, and adding them without that evidence would be
  guessing at thresholds rather than deriving them. This is recorded as an
  open item for whoever runs the first real dry-run, not silently skipped.

## Review gate

Before any Phase 8 backfill: run this scanner against a real environment,
publish its aggregate report (examined / resolved / conflict / orphaned /
unsupported / invalid / unavailable / already-scoped counts only — no row
identifiers), and get that report reviewed by the named Phase 3 owner. This
document does not constitute that review.
