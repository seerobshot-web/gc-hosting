# GLINKS Import & Reconciliation

> **Status: design only.** This document defines the job lifecycle, conflict rules,
> idempotency keys, audit events, retry behavior, and GLINKS endpoint contract for
> migrating legacy GLINKS link records into GCH's own `GLink` table. It intentionally
> ships **before** any Prisma schema change — see
> [Proposed schema (not yet applied)](#proposed-schema-not-yet-applied). No migration
> should be written against this doc until it is reviewed; treat the models below as a
> draft for that review, not as source of truth.

## Scope and relationship to other docs

This is the "how do the two get reconciled" doc. The two systems it reconciles are
already defined elsewhere and are not redefined here:

- [GLINKS-INTEGRATION.md](./GLINKS-INTEGRATION.md) — the isolation contract: GLINKS is
  a black box reached only through the HMAC-signed adapter (`GlinksHttpClient`),
  never a direct DB connection. Every read in this doc goes through that adapter.
- [IDEMPOTENCY.md](./IDEMPOTENCY.md) — the deterministic idempotency-key convention
  this doc reuses rather than inventing a second scheme.
- `apps/api/src/glinks/` — `GLink` is GCH's own org/client-scoped module-link model
  (`GLinkModuleType`: `LINK`, `GIVING_EXTERNAL`, `EVENT`, `SERMON_SERIES`,
  `ANNOUNCEMENT`, `SOCIAL_EMBED`). Reconciliation's job is to populate this table from
  legacy GLINKS data — it never becomes a second authority for link data once a record
  is imported.

Reconciliation is **one-directional and one-time per record**: a legacy link is read
from GLINKS, mapped, and written into GCH's `GLink` once. After a record is imported,
GCH's copy is the one operators edit going forward; reconciliation does not attempt
continuous two-way sync. Re-running a job is safe (idempotent) but does not pull
updates for already-imported records — see [Conflict rules](#conflict-rules) for the
one exception (an operator explicitly requesting a re-import).

## Job lifecycle

A **`MigrationJob`** is the unit of work for importing one org's (or one client's)
legacy links. It runs as a standalone script in `workers/cron-jobs`, following the
same pattern as `resellportal-poller.ts`: no NestJS DI container, a small duplicated
HMAC-signing call against the GLINKS adapter's contract, `prisma` used directly.

```
        create (operator-triggered or backfill script)
              |
              v
  +--------+     claim      +---------+
  | PENDING | -------------> | RUNNING |
  +--------+                +---------+
                               |  |  |
                 all records   |  |  fetch/mapping error,
                 imported OK   |  |  retries exhausted
                               |  |
                     +---------+  +---------+
                     v                       v
              +-----------+           +--------+
              | COMPLETED |           | FAILED |
              +-----------+           +--------+
                     |
       some records landed in MigrationConflict
                     |
                     v
              +-----------+
              | PARTIAL   |
              +-----------+
```

| State | Meaning |
| --- | --- |
| `PENDING` | Job row created, not yet claimed by a worker run. |
| `RUNNING` | Claimed by a worker (see claim pattern below); actively paging through GLINKS. |
| `COMPLETED` | Every fetched legacy record was either imported or was already previously imported (idempotent no-op). Zero conflicts. |
| `PARTIAL` | Job finished paging GLINKS, but one or more records landed in `MigrationConflict` instead of being imported. The job itself did not fail — it did everything it could — but it isn't done until conflicts are resolved. |
| `FAILED` | The job could not complete a full pass (GLINKS adapter error, exhausted retries — see [Retry behavior](#retry-behavior)). Safe to re-run from `PENDING`; already-imported records are skipped idempotently. |

### Claim pattern

Job claiming reuses the exact transactional pattern already established in
`resellportal-poller.ts` (`updateMany` with a status-guarded `where`, only the
transition that actually moved 1 row is treated as "won"), so two overlapping worker
invocations can never both process the same job:

```ts
const claimed = await prisma.migrationJob.updateMany({
  where: { id: job.id, status: "PENDING" },
  data: { status: "RUNNING", startedAt: new Date() },
});
if (claimed.count === 0) continue; // another run already claimed it
```

### Granularity

A job is scoped to **one GCH org** (`orgId`), which maps to one legacy GLINKS
"client" in the external system (the org-to-legacy-client mapping is an explicit
field on the job, not inferred — see [proposed schema](#proposed-schema-not-yet-applied)).
Org-scoped jobs mean a stuck or slow legacy client never blocks others, and a failed
job can be retried in isolation without re-touching orgs that already completed.

## Conflict rules

A **`MigrationConflict`** row is created — instead of writing/overwriting a `GLink` —
whenever the importer cannot safely decide the outcome automatically. Conflicts are
never auto-resolved by the importer; they require an operator decision (a follow-up
admin action, out of scope for this doc beyond the data model it needs).

| Conflict type | Trigger | Why it isn't auto-resolved |
| --- | --- | --- |
| `DUPLICATE_LEGACY_ID` | The legacy record's id was already imported (a `GLink.legacyId` match exists) but its content (label/url/moduleType) differs from what's stored. | Could mean the legacy record was edited after the first import, or the mapping is wrong. Silently overwriting risks clobbering an operator's edit made in GCH since the first import. |
| `UNMAPPABLE_MODULE_TYPE` | The legacy record's category has no entry in the moduletype mapping table (see [Endpoint contract](#glinks-endpoint-contract-typed-methods)). | `GLinkModuleType` is a closed, deliberately-curated enum (see the schema comment on it) — the importer must never guess a mapping for an unrecognized legacy category. |
| `MISSING_REQUIRED_FIELD` | Legacy record has no label, or has a URL that fails GCH's `IsUrl({ require_protocol: true })` validation already enforced on `CreateGLinkDto`. | Importing an invalid record would violate the same validation GCH enforces on every other write path to `GLink`; better to flag than to write dirty data via a side door. |
| `AMBIGUOUS_CLIENT` | The legacy record belongs to a legacy client id that maps to more than one GCH `Client` under the org, or to none. | Reconciliation only writes into an already-resolved `orgId`/`clientId`; an ambiguous mapping is an operator/data problem, not something the importer should pick a side on. |

Conflicts are resolved by an operator action that either (a) supplies a corrected
mapping and re-runs just that record, or (b) explicitly discards the legacy record.
Both actions are audited (see below) and both go through the same `GLink` write path
services already use (`GlinksService.create`), never a bespoke conflict-resolution
write path — conflict resolution is not exempt from the validation every other `GLink`
write goes through.

## Idempotency keys

Reconciliation reuses the deterministic convention from
[IDEMPOTENCY.md](./IDEMPOTENCY.md) rather than inventing a parallel scheme:

```
idempotencyKey = sha256( "GLinksImport" + ":" + legacyRecordId + ":" + "import" )
```

- `entityType` is the literal `"GLinksImport"`.
- `entityId` is the legacy record's id as returned by GLINKS (stable per legacy row).
- `operationName` is `"import"`.

The same legacy record always hashes to the same key regardless of which job run or
which page of results it was fetched on, so:

- Re-running a `FAILED` job from `PENDING` recomputes identical keys for
  already-imported records and short-circuits them (claim-first insert into
  `IdempotencyRecord` conflicts → skip, don't re-import).
- A record straddling two overlapping job pages (possible if GLINKS pagination
  isn't perfectly stable under concurrent reads) is still only imported once.

TTL: reconciliation runs are backfills, not time-sensitive polling, so import
idempotency records use the existing **7-day** provisioning-class TTL rather than the
24-hour default — a job re-run days later (e.g. after a conflict-heavy first pass was
partially fixed and re-triggered) must still recognize earlier successful imports.

## Audit events

Every state-changing action goes through the existing `AuditService.logAction`
(`apps/api/src/audit/audit.service.ts`) — reconciliation gets no separate audit
mechanism, consistent with it being "the single write path every module... goes
through." `actor` is the worker identity string, matching the `system:cron-*`
convention already used by `resellportal-poller.ts`.

| `action` | `targetType` | `targetId` | When |
| --- | --- | --- | --- |
| `migrationJob.started` | `MigrationJob` | job id | Job transitions `PENDING` → `RUNNING`. |
| `glink.imported` | `GLink` | new `GLink` id | A legacy record is written as a new `GLink`. `metadata` includes `legacyRecordId`. |
| `glink.import.conflict` | `MigrationConflict` | conflict id | A record is routed to a conflict instead of being imported. `metadata` includes `conflictType` and `legacyRecordId`. |
| `glink.import.conflict.resolved` | `MigrationConflict` | conflict id | Operator resolves a conflict (import-with-correction or discard). `metadata` includes the resolution and, on import, the resulting `GLink` id. |
| `migrationJob.completed` \| `migrationJob.partial` \| `migrationJob.failed` | `MigrationJob` | job id | Terminal state reached. `metadata` includes counts: `{ imported, skipped, conflicts }`. |

## Retry behavior

Reconciliation distinguishes two failure classes, matching how `resellportal-poller.ts`
already treats per-order try/catch vs. a hard adapter error:

1. **Per-record failure** (a single legacy record's mapping throws, e.g. malformed
   payload from GLINKS for that one row) — caught, does **not** abort the job, and
   either becomes a `MigrationConflict` (if it's a data problem — see
   [Conflict rules](#conflict-rules)) or is logged and counted as `skipped` (if it's
   clearly transient, e.g. a single malformed page entry) for the next run to pick up.
   The job keeps paging.

2. **Job-level failure** (the GLINKS adapter call itself fails — network error, non-2xx,
   signature rejection) — retried with bounded exponential backoff **within the same
   job run**: 3 attempts, `1s, 4s, 16s` delays, matching the "belt-and-suspenders sweep"
   philosophy the poller already uses rather than introducing a new retry library.
   If all 3 attempts fail, the job transitions to `FAILED` and stops — it does not
   silently continue with partial legacy data, since GLINKS is the source of truth and
   a broken page fetch could mean the rest of the page ordering/pagination cursor is
   now unreliable.

A `FAILED` job is safe to re-run from `PENDING` (new job row, or the same row reset to
`PENDING` by an operator) because every write is idempotency-key-guarded; re-running
never double-imports.

No retry ever writes to the legacy GLINKS database — retries only re-issue the same
signed `GET` through `GlinksHttpClient`, consistent with the read-only nature of this
whole workflow (see [Hard rules](./GLINKS-INTEGRATION.md#hard-rules): GCH never
migrates, alters, or seeds GLINKS).

## GLINKS endpoint contract (typed methods)

`GlinksHttpClient.request()` currently exists as the signed-transport shell (per its
own doc comment, "Typed request methods land in Phase 6; this ships the adapter shell
+ the signature contract"). Reconciliation needs exactly one new typed, paginated read
method added to that Phase 6 surface — no new adapter class, per the "every external
call goes through a typed adapter" rule in CONTRIBUTING.md:

```ts
// apps/api/src/glinks/glinks-http.client.ts (Phase 6 addition — not yet implemented)
interface LegacyLinkRecord {
  id: string;              // legacy record id — becomes GLink.legacyId
  legacy_client_id: string;
  category: string;        // legacy category string — mapped via MODULE_TYPE_MAP
  label: string;
  url: string | null;
  position: number;
  updated_at: string;      // ISO timestamp, used only for conflict diagnostics
}

interface LegacyLinksPage {
  data: LegacyLinkRecord[];
  next_cursor: string | null; // opaque cursor; null means last page
}

async listLinksForClient(
  legacyClientId: string,
  cursor?: string,
): Promise<LegacyLinksPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return this.request<LegacyLinksPage>(`/api/v1/clients/${legacyClientId}/links${qs}`);
}
```

Contract notes:

- **Versioned path** (`/api/v1/...`), per the existing versioning rule — a breaking
  GLINKS change ships as `/api/v2/...` and the importer's adapter method pins the
  version it speaks, same as every other GLINKS call.
- **Cursor pagination**, not offset — legacy record counts per client are expected to
  be small, but cursor pagination avoids skip/duplicate rows if a legacy record is
  added mid-page during a long-running backfill.
- **Read-only.** This is a `GET`; reconciliation never issues a mutating call against
  GLINKS. There is no "mark as migrated" callback into GLINKS — GCH's own
  `MigrationJob`/`GLink.legacyId` state is the only migration bookkeeping that exists,
  consistent with "GLINKS is the source of truth for GLINKS data, full stop."
- **Module-type mapping** (`MODULE_TYPE_MAP: Record<string, GLinkModuleType | undefined>`)
  lives beside the importer, not in the adapter — the adapter only transports legacy
  data verbatim; deciding what a legacy `category` string means in GCH's closed enum
  is reconciliation's business logic, not the adapter's.

## Proposed schema (not yet applied)

Shown for review only — **do not migrate against this until it's approved**, per this
document's own scope note above.

```prisma
model MigrationJob {
  id             String    @id @default(cuid())
  orgId          String
  org            Org       @relation(fields: [orgId], references: [id])
  legacyClientId String    // the GLINKS-side client id this job reconciles
  status         String    @default("PENDING") // PENDING | RUNNING | COMPLETED | PARTIAL | FAILED
  cursor         String?   // last successfully processed GLINKS page cursor, for resuming
  importedCount  Int       @default(0)
  skippedCount   Int       @default(0)
  conflictCount  Int       @default(0)
  startedAt      DateTime?
  finishedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  conflicts      MigrationConflict[]

  @@index([orgId])
  @@index([status])
}

model MigrationConflict {
  id             String       @id @default(cuid())
  jobId          String
  job            MigrationJob @relation(fields: [jobId], references: [id])
  legacyRecordId String
  conflictType   String       // DUPLICATE_LEGACY_ID | UNMAPPABLE_MODULE_TYPE | MISSING_REQUIRED_FIELD | AMBIGUOUS_CLIENT
  legacyPayload  Json         // raw legacy record, for operator review / re-import
  resolvedAt     DateTime?
  resolution     String?      // IMPORTED | DISCARDED, set when resolvedAt is set
  createdAt      DateTime     @default(now())

  @@index([jobId])
  @@index([conflictType])
}
```

And the one field this design needs added to the existing `GLink` model, to make an
imported row traceable back to its legacy source and to detect
`DUPLICATE_LEGACY_ID` conflicts:

```prisma
model GLink {
  // ...existing fields unchanged...
  legacyId String? @unique // GLINKS record id, set only for imported rows; null for GCH-native links
}
```

## Open questions for review before schema work starts

- Should a `COMPLETED` job with zero legacy records (an org with nothing to migrate)
  be distinguishable from one that imported records? Current design: both are
  `COMPLETED`; `importedCount` on the job row answers "how many," so no extra state
  is needed.
- Is `MigrationJob.cursor` (resume-from-last-page) needed for the expected legacy data
  volume, or is a full re-page acceptable on every `FAILED` retry given idempotency
  already makes re-paging safe? Leaning toward keeping it — it turns a retry after a
  late-page failure from O(all pages) back to O(remaining pages) at negligible schema
  cost.
- Conflict resolution's admin surface (who resolves `MigrationConflict` rows and
  through what endpoint) is explicitly out of scope here and needs its own design
  pass before `glink.import.conflict.resolved` can be implemented.
