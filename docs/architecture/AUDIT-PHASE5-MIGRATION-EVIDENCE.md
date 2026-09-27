# Phase 5 — nullable `AuditLog.orgId` migration: evidence

**Status: migration authored and disposable-database-tested; not applied to
any shared or production database.** This is the evidence record required by
the Phase 5 exit gate in `docs/architecture/GCH-REMAINDER-IMPLEMENTATION-PLAN`
and by the disposable-MySQL plan approved in `AUDIT-PHASE3-APPROVAL-RECORD.md`.

## Deviation from the approved plan, recorded honestly

The Phase 3 record approved a **Docker**-based disposable MySQL container.
`docker` is present in this environment, but every `docker pull mysql:8.0`
attempt (`docker.io/library/mysql:8.0`) failed with a registry-side `429 Too
Many Requests` — an anonymous Docker Hub pull-rate limit on the environment's
shared egress IP, not a proxy policy denial (`curl .../__agentproxy/status`
showed no relevant denial). Rather than fabricate Docker evidence or skip the
disposable test, this phase used a **locally apt-installed MySQL 8.0.46**
server (`mysql-server` from Ubuntu's own archive, not Docker Hub) inside this
same ephemeral, single-use execution container. It is disposed of at the end
of this phase (see Teardown below) and never persisted beyond it — the same
isolation and ephemerality properties the approved plan called for, achieved
by a different mechanism than originally named. Nothing in this record
claims Docker was used.

## What was tested, exactly

1. Installed MySQL 8.0.46, started it manually (no systemd in this
   container), created a throwaway database (`gch_disposable_test`) and a
   throwaway user with a randomly generated password never used elsewhere
   and never committed.
2. Applied all 6 existing migrations via `prisma migrate deploy` to bring
   the disposable database to the current baseline schema — the same
   command a real deployment runs.
3. Edited `packages/database/prisma/schema.prisma`: added `AuditLog.orgId
   String?`, the `org Org?` relation (`onDelete: SetNull`), the composite
   index, and the `Org.auditLogs AuditLog[]` back-relation (for consistency
   with every other Org relation in this schema).
4. Generated the migration with `prisma migrate dev --create-only` (creates
   without applying, so it could be inspected first) and confirmed the
   output matches the approved design exactly:

   ```sql
   -- AlterTable
   ALTER TABLE `AuditLog` ADD COLUMN `orgId` VARCHAR(191) NULL;

   -- CreateIndex
   CREATE INDEX `AuditLog_orgId_createdAt_id_idx` ON `AuditLog`(`orgId`, `createdAt`, `id`);

   -- AddForeignKey
   ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `Org`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
   ```

5. Applied it with `prisma migrate deploy`; timed at **0.9s** on the (empty)
   disposable table. `ADD COLUMN ... NULL` with no default is an instant,
   metadata-only operation in MySQL 8.0.12+; `CREATE INDEX` and `ADD
   CONSTRAINT` both use InnoDB's `INPLACE` algorithm (non-blocking for
   concurrent reads/writes, but the index build and FK-validation scan take
   time proportional to table size — new-row inserts are not blocked, but
   the ALTER itself holds a metadata lock only briefly at start/end). On a
   large production table, expect the wall-clock cost to scale with row
   count for the index build; a null-only FK validation scan is cheap
   because every existing row already satisfies "NULL is a valid FK value."
   Exact production timing was not measured — that requires the real
   table's size, which was not inspected here.
6. Verified the FK behavior end-to-end with real rows: inserted an `Org`
   and an `AuditLog` row citing it (`orgId` populated), then deleted the
   `Org`. Result: the `AuditLog` row survived with `orgId` set to `NULL`,
   every other field (`actor`, `action`, `targetType`, `targetId`,
   `metadata`, `createdAt`) unchanged. This is the exact "preserve history,
   let Org deletion proceed" behavior the Phase 3 decision approved.
7. Tested the rollback path, since Prisma migrations are forward-only and
   generate no down-migration: manually ran
   `DROP FOREIGN KEY` → `DROP INDEX` → `DROP COLUMN orgId` against a
   database with one row whose `orgId` had already been populated. Result:
   the rollback succeeded in **27ms**, and the row's original fields
   (`actor`, `action`, `targetType`, `targetId`) survived — but the
   populated `orgId` value was **irrecoverably destroyed** by `DROP COLUMN`.
   This confirms, with a real test rather than an assumption, the concern
   already on record: **a rollback is only safe before any row has been
   populated.** After Phase 6/8 populate real rows, "rollback" must mean
   forward repair (re-add the column, re-run the resolver-based backfill),
   never a blind `DROP COLUMN`.
8. Regenerated the Prisma client from the new schema and re-ran this
   workspace's own build, lint, typecheck, and full test suite (`pnpm
   build && pnpm lint && pnpm typecheck && pnpm test`) — all green, 149
   tests passing (up from 147; the two new ones are unrelated Phase 4
   coverage). No test in this repository touches a real database — they
   all mock the Prisma client — so this schema change could not by itself
   have been caught by the test suite; the disposable-database steps above
   are what actually exercises it.

## Adversarial finding: FK convention consistency

Every other `Org` relation already in this schema (`Client`, `GLink`,
`Membership`, `Subscription`, `Invoice`) uses `ON DELETE RESTRICT`, meaning
an `Org` cannot actually be deleted today while any of those rows exist,
regardless of `AuditLog`'s FK behavior. This does not weaken the Phase 3
rationale for `SET NULL` on `AuditLog` — it sharpens it: `AuditLog` is the
one purely historical/forensic table in this schema, unlike the others,
which represent live operational state that a deliberate multi-step admin
purge would need to explicitly detach in order anyway. If such a purge flow
is ever built, `AuditLog`'s `SET NULL` behavior is what lets that flow reach
the `Org` row itself without either being blocked by its own audit history
or destroying that history. Recorded here as evidence a genuine adversarial
review pass was done, not merely a copy of the prior decision.

## Files changed

- `packages/database/prisma/schema.prisma`: `AuditLog.orgId`, its relation,
  the composite index, and `Org.auditLogs` back-relation.
- `packages/database/prisma/migrations/20260927115452_audit_log_org_scope/migration.sql`:
  the generated migration, applied to and verified against the disposable
  database only.

## Teardown

The disposable database and its throwaway user were dropped
(`DROP DATABASE gch_disposable_test`, `DROP USER 'gch_test'@'localhost'`)
and the local MySQL instance was shut down
(`mysqladmin shutdown`) immediately after this evidence was collected,
confirmed by a subsequent failed connection attempt. No data, credential, or
running process from this test remains. Nothing here was applied to any
shared, staging, or production database, and no `DATABASE_URL` pointing at
this or any other real database was ever configured for the application
itself in this session.

## What this phase does not do

This phase adds the column, relation, and index only. No writer populates
`orgId` yet (Phase 6). No scanner reads it in bulk yet (Phase 7). No
historical backfill or audit-read restoration happens yet (Phase 8). No
production or shared database was touched.
