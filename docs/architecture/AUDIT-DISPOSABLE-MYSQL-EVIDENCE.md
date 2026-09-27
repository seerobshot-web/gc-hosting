# Audit tenant-key migration: disposable MySQL evidence gate

**Status: blocked, design only.** This record is for the GCH `@gch/database` Prisma/MySQL workspace. It neither approves an `AuditLog.orgId` FK/delete rule nor changes schema or applies any migration. Keep `GET /audit` at 400 (missing scope), 404 (nonmember), and 503 (member while ownership is unavailable), with zero audit-row reads on the unavailable path.

## Files inspected and supported commands

- `packages/database/prisma/schema.prisma`: MySQL datasource reads `DATABASE_URL`; `AuditLog` has no `orgId`.
- `packages/database/prisma/migrations/migration_lock.toml`: `provider = "mysql"`.
- `packages/database/prisma/migrations/20260914094923_add_org_slug/migration.sql`: the earlier two-phase migration **updates** old rows. Its existence is not approval to update audit history.
- `packages/database/package.json`: `generate` invokes `prisma generate`; `migrate:dev` invokes `prisma migrate dev`. No disposable test setup or teardown command appears here.
- `packages/database/src/index.ts`: PrismaClient is initialized from the datasource environment.
- `packages/database/scripts/backfill-identity.ts`: performs unbounded reads and writes to user/client/membership tables; it must not be used for audit migration testing.
- `packages/database/.env.example` and root `.env.example`: example MySQL URLs; examples are not proof that any current connection is isolated.
- `package.json`: root build, lint, typecheck and test scripts; Node >=22 and pnpm 9.15.0.
- `.github/workflows/ci.yml`: runs install, Prisma generation, build, lint, typecheck, tests and production dependency audit. It provisions **no GCH MySQL service** and runs **no migration**.
- `.github/workflows/codeql.yml`: CodeQL workflow targets pull requests to `main`, pushes to `main`, weekly schedule and manual dispatch; its availability probe can skip analysis when code scanning is disabled.
- `docs/architecture/AUDIT-TENANT-KEY-PR62A.md` and `docs/architecture/AUDIT-PHASE3-APPROVAL-CLOSURE.md`: record unapproved FK delete policy, owner assignments, operational inventory and test environment.
- Search also found `apps/glinks` and `.github/workflows/glinks.yml` isolated **PostgreSQL** tests. That is a separate application/database and supplies no GCH MySQL isolation evidence.

This inspection found no approved GCH MySQL disposable-instance creation, fixture seeding, isolation verification, migration replay, credential revocation or destruction procedure. Repository search is not a complete inventory of external infrastructure. No database was connected or created in this investigation.

## Required evidence before any isolated DB test

| Decision / proof | Required evidence and reviewer | Status |
| --- | --- | --- |
| Isolation | Test infrastructure owner identifies a new single-use MySQL instance/database and its destruction mechanism; provide evidence that it contains only synthetic fixtures and cannot reach production, staging or shared development. Named owner unassigned. | **BLOCKED** |
| Connection preflight | Database operator approves an out-of-band check of server/database identity and permissions, with production/shared identifiers explicitly denied. Reject empty, ambiguous or unexpected `DATABASE_URL`. Do not display URLs, usernames, hosts or credentials in logs. | **BLOCKED** |
| Least privilege and teardown | Use disposable per-run credentials; document how they and the isolated database are revoked/destroyed even on failure or cancellation, and verify no resources remain. | **BLOCKED** |
| Version and fidelity | Record disposable and target MySQL version/configuration and Prisma compatibility; do not claim matching behavior from local generation alone. | **BLOCKED** |
| Operational inventory | Sanitized current audit row count, table/index size, storage headroom, representative insert/write rate, concurrent DDL constraints, engine/lock settings and version; no raw audit rows or identifiers. | **BLOCKED** |
| FK/index decision | Data-retention and schema owners select FK target and delete behavior; API/database owners approve scoped read query, index and an explain plan. No FK/index DDL until approved. | **BLOCKED** |
| Execution controls | Name migration and rollback owners, maintenance window, lock/wait/time budget, abort condition, backups and demonstrated restore, and forward-repair procedure. | **BLOCKED** |
| Fixture protocol | Test owner supplies bounded synthetic legacy audit rows and Org rows, including nullable scope, deleted-target/ambiguous classifications and no sensitive data; identify allowed seed and cleanup commands. | **BLOCKED** |
| Migration command | `migrate:dev` is the existing package script, but its use on a disposable DB requires approved preflight and migration files. Do not assume it is safe on any provided URL. Select a repository-supported validation command when the migration exists; report its actual outcome. | **BLOCKED** |

## Future test sequence (not executed)

1. Obtain sign-off for every table row and all tenant-key approval decisions. The test infrastructure owner creates an isolated database and ephemeral credentials under an approved procedure.
2. Preflight its environment and isolation without printing connection details. Confirm bounded, synthetic data and reject production/staging/shared identities. Capture MySQL version and a safe configuration summary.
3. Record a baseline of synthetic legacy `AuditLog` row counts and content digests without exposing identifiers. Seed with an approved bounded method; no production clone or customer records.
4. Apply only the separately approved additive migration using the existing package migration convention against the isolated connection. Observe lock waits, duration and any errors; enforce the approved abort budget.
5. Assert original rows and fields are unchanged, nullable `orgId` accepts unchanged writers and unscoped legacy rows, the approved FK target and delete action are enforced, and only the approved index exists. Assert migration SQL performs no historical update/delete/backfill. Exercise negative and conflicting fixtures without assigning their organization.
6. Validate safe rollback or forward repair *per the approved retention policy*. Dropping a populated ownership column can destroy data; do not make it an automatic rollback. Verify restore on the disposable instance with bounded synthetic data.
7. Repeat from a fresh disposable database if the approved procedure requires reproducibility. Revoke the credentials and destroy the instance/database; verify teardown. Publish aggregate pass/fail, version and timing only, without URLs, hosts, usernames, row IDs or raw exceptions.

**Do not execute this sequence now.** Generation and ordinary CI tests cannot establish that DDL applies, that FK deletion behaves as desired or that MySQL locks stay within budget. GLINKS's PostgreSQL service is not an acceptable substitute. Fail closed if isolation, approval, cleanup or measurement evidence is unavailable.

## Ownership and handoff

Test infrastructure owner, database operator, migration owner, rollback owner, data-retention/schema owner, and API read owner are **unassigned** until recorded approval identifies people. Link this record in any future migration PR; preserve the audit read refusal through schema drafting, isolated testing and historical reconciliation. No shared/prod connection, schema change, migration file, backfill, external provider action, payment, fulfillment, provisioning, deployment or entitlement action is part of this document.
