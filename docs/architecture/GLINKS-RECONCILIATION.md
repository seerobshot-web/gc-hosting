# GLINKS Import & Reconciliation

> **Status: design only.** This document defines the job lifecycle, conflict rules,
> idempotency keys, audit events, retry behavior, and GLINKS endpoint contract for
> migrating legacy GLINKS link records into GCH's own `GLink` table. It intentionally
> ships **before** any Prisma schema change — see
> [Proposed schema (not yet applied)](#proposed-schema-not-yet-applied). No migration
> should be written against this doc until it is reviewed; treat the models below as a
> draft for that review, not as source of truth.

## Governance prerequisite: this needs an ADR, not just doc review

This design cannot be implemented under the repository's **current** governance as
written, and that conflict is deliberate to surface here rather than paper over:

- [GLINKS-INTEGRATION.md](./GLINKS-INTEGRATION.md#what-gch-must-never-do) lists
  "Duplicate GLINKS-owned records as authority inside GCH" under **What GCH must never
  do**.
- The [README's consolidation status table](../../README.md#consolidation-status) has
  `GLINKS source of truth: Legacy inventory until ADR approval` as a standing row.

Import, as designed below, makes GCH's `GLink` the record operators edit going forward
for an imported link — i.e. it deliberately ends GLINKS's authority over that specific
record. That is not the continuous dual-authority the "must never duplicate" rule is
aimed at (this workflow is explicitly one-time, operator-initiated, and never a
background daemon silently mirroring live GLINKS edits back into GCH) — but it *is* a
transfer of authority, and the governing docs don't yet have a carve-out for that.
**This document does not grant itself that carve-out.** Before any `MigrationJob` code
is written:

1. An ADR must approve reconciliation as the intentional exception, narrowly scoped to
   "explicit, one-time, operator-initiated import of a specific record" — never
   continuous sync, never automatic/unattended.
2. That ADR must update the README's consolidation-status row so "GLINKS source of
   truth" reads per-record (imported → GCH; not yet imported → GLINKS) rather than
   as a single legacy-wide statement.
3. [GLINKS-INTEGRATION.md](./GLINKS-INTEGRATION.md) must gain an explicit cross-link to
   that ADR next to its "must never duplicate" rule, so the hard rule and its one
   approved exception are never read in isolation from each other.

Everything below is the mechanism design for *if* that ADR is approved — it is not
itself the approval, and is written so the ADR reviewer has a concrete design to
approve or reject rather than a policy question in the abstract.

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
  legacy GLINKS data.

Reconciliation is **one-directional and one-time per record**: a legacy link is read
from GLINKS, mapped, and written into GCH's `GLink` once. Per the
[governance prerequisite](#governance-prerequisite-this-needs-an-adr-not-just-doc-review)
above, this is a deliberate, per-record transfer of authority from GLINKS to GCH, not a
live mirror — GLINKS keeps every record GCH has not (yet) imported, and once a record
*is* imported, GCH's copy is the one operators edit going forward. Reconciliation does
not attempt continuous two-way sync, and does not go back and re-pull updates for
already-imported records — see [Conflict rules](#conflict-rules) for the one exception
(an operator explicitly requesting a re-import).

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
  data: { status: "RUNNING", startedAt: new Date(), heartbeatAt: new Date() },
});
if (claimed.count === 0) continue; // another run already claimed it
```

While `RUNNING`, the worker updates `heartbeatAt` after every successfully processed
GLINKS page (not just at claim time). This is what makes a `RUNNING` job recoverable
if the worker process dies mid-run (killed, host restart) instead of reaching a
terminal state cleanly — without a heartbeat, that job's row would stay `RUNNING`
forever, since the claim `where` above only ever matches `PENDING`. Before claiming new
`PENDING` work, every worker invocation first sweeps for abandoned jobs and reclaims
them the same guarded way:

```ts
const STALE_AFTER_MS = 15 * 60 * 1000; // longer than one page's retry budget (3 attempts, max 1s+4s+16s backoff) leaves ample margin
await prisma.migrationJob.updateMany({
  where: { status: "RUNNING", heartbeatAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
  data: { status: "PENDING" },
});
```

A reclaimed job resumes from `cursor` (see [proposed schema](#proposed-schema-not-yet-applied)),
so a page that was already durably recorded is not re-fetched; only the abandoned
page and beyond are re-processed. Because every write on that page is
idempotency-key-guarded (see [Idempotency keys](#idempotency-keys)), even a page that
was partially processed before the worker died cannot double-import.

### Granularity

A job is scoped to **one GCH org** (`orgId`) *and* one legacy GLINKS "client"
(`legacyClientId`) — the field the job uses to call
`listLinksForClient(legacyClientId, cursor)` (see
[Endpoint contract](#glinks-endpoint-contract-typed-methods)). Org+legacy-client scoped
jobs mean a stuck or slow legacy client never blocks others, and a failed job can be
retried in isolation without re-touching clients that already completed.

`legacyClientId` alone tells the job *what to fetch*; it does not by itself tell the
job *where in GCH to write*. That destination-mapping gap is closed by a new field on
the existing `Client` model (see [proposed schema](#proposed-schema-not-yet-applied)):

```prisma
model Client {
  // ...existing fields unchanged...
  legacyGlinksClientId String? @unique // the GLINKS-side client id this GCH Client was migrated from
}
```

At the `RUNNING` transition (before paging starts), the job resolves its single
destination `clientId` once:

```ts
const client = await prisma.client.findFirst({
  where: { orgId: job.orgId, legacyGlinksClientId: job.legacyClientId },
});
if (!client) {
  // No GCH Client claims this legacy client id under this org — a job-level
  // precondition failure, not a per-record conflict, since nothing about the
  // page contents could resolve it. Job -> FAILED with reason "unmapped client".
}
```

The `@unique` constraint on `legacyGlinksClientId` guarantees at most one match, so
this resolves to exactly zero or one `Client` — never "more than one," which is why
`AMBIGUOUS_CLIENT` (below) is scoped to the case that constraint can't prevent: a
per-record `legacy_client_id` on an individual fetched row that doesn't match the
job's own `legacyClientId` at all (a legacy data-quality problem, e.g. GLINKS returning
a record from client B on client A's page).

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
| `RECORD_PROCESSING_ERROR` | Mapping a specific fetched record throws an exception that isn't one of the recognized cases above (e.g. a malformed field the mapper didn't expect). | A catch-all is required precisely so nothing is ever silently dropped — see [Retry behavior](#retry-behavior): every per-record failure resolves to *some* row, never a bare log line with no follow-up state. |
| `AMBIGUOUS_CLIENT` | An individual fetched record's own `legacy_client_id` doesn't match the job's `legacyClientId` (the job already resolved its single destination `Client` at `RUNNING` — see [Granularity](#granularity) — so this means GLINKS returned a record that doesn't belong on this page). | The job-level client resolution already ruled out "no destination exists"; a per-record mismatch past that point is a legacy data-quality problem, not something the importer should silently reassign or drop. |

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

### Atomicity

A claim (the `IdempotencyRecord` insert) must never be able to succeed without the
`GLink` it's claiming for also landing — otherwise a crash between the two leaves a
key that's claimed but never imported, and every future retry sees the key, treats it
as "already handled," and skips a record that was never actually written. The claim,
the `GLink` create, and the audit-log write for `glink.imported` are therefore one
`prisma.$transaction`, matching the same claim-and-audit atomicity
`resellportal-poller.ts` already uses for its `provisioning -> deployed` transition:

```ts
const key = idempotencyKey("GLinksImport", legacyRecord.id, "import");

const created = await prisma.$transaction(async (tx) => {
  try {
    await tx.idempotencyRecord.create({
      data: { key, result: {}, expiresAt: addDays(new Date(), 7) },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) return null; // already claimed by an earlier attempt
    throw err;
  }

  const glink = await tx.gLink.create({
    data: { ...mapped, legacyId: legacyRecord.id, clientId, orgId: job.orgId },
  });

  await tx.auditLog.create({
    data: {
      actor: "system:cron-glinks-importer",
      action: "glink.imported",
      targetType: "GLink",
      targetId: glink.id,
      metadata: JSON.stringify({ legacyRecordId: legacyRecord.id }),
    },
  });

  return glink;
});

if (created === null) {
  /* already imported in an earlier attempt — counted as already-imported, not re-counted as imported */
}
```

If the transaction fails partway (e.g. the `GLink` create violates a constraint), the
whole transaction rolls back — including the `IdempotencyRecord` insert — so the key
is *not* left claimed, and the next attempt (this run, or a re-run) sees a clean slate
and can retry the same record rather than being permanently skipped. The only durable
"claimed" state is one where the `GLink` and its audit row also exist.

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
| `migrationJob.completed` \| `migrationJob.partial` \| `migrationJob.failed` | `MigrationJob` | job id | Terminal state reached. `metadata` includes counts: `{ imported, alreadyImported, conflicts }`. |

## Retry behavior

Reconciliation distinguishes two failure classes, matching how `resellportal-poller.ts`
already treats per-order try/catch vs. a hard adapter error:

1. **Per-record failure** (a single legacy record's mapping throws, e.g. malformed
   payload from GLINKS for that one row) — caught, does **not** abort the job, and
   **always** resolves to one of exactly two outcomes, never a bare "log and move on":
   either it's imported (or recognized as already-imported, via the idempotency claim),
   or it becomes a `MigrationConflict` — a recognized type (see
   [Conflict rules](#conflict-rules)) when the failure matches one, and
   `RECORD_PROCESSING_ERROR` as the catch-all otherwise. There is no third "transient,
   silently skip" bucket: a conflict row is exactly the durable, retryable record of
   "this needs a follow-up," and `MigrationJob.conflictCount` is what keeps that
   follow-up from being lost. This is also why `COMPLETED` requires zero conflicts —
   any per-record failure that isn't resolved by the idempotent-import path necessarily
   produced a conflict row, which forces the job to `PARTIAL` instead. The job keeps
   paging after a per-record failure.

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
  id                  String    @id @default(cuid())
  orgId               String
  org                 Org       @relation(fields: [orgId], references: [id])
  legacyClientId      String    // the GLINKS-side client id this job reconciles
  status              String    @default("PENDING") // PENDING | RUNNING | COMPLETED | PARTIAL | FAILED
  cursor              String?   // last successfully processed GLINKS page cursor, for resuming
  heartbeatAt         DateTime? // updated after every processed page while RUNNING; stale -> reclaimable to PENDING
  importedCount       Int       @default(0)
  alreadyImportedCount Int      @default(0)
  conflictCount       Int       @default(0)
  startedAt           DateTime?
  finishedAt          DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  conflicts      MigrationConflict[]

  @@index([orgId])
  @@index([status])
  @@index([status, heartbeatAt]) // supports the stale-RUNNING reclaim sweep
}

model MigrationConflict {
  id             String       @id @default(cuid())
  jobId          String
  job            MigrationJob @relation(fields: [jobId], references: [id])
  legacyRecordId String
  conflictType   String       // DUPLICATE_LEGACY_ID | UNMAPPABLE_MODULE_TYPE | MISSING_REQUIRED_FIELD | RECORD_PROCESSING_ERROR | AMBIGUOUS_CLIENT
  legacyPayload  Json         // raw legacy record, for operator review / re-import
  resolvedAt     DateTime?
  resolution     String?      // IMPORTED | DISCARDED, set when resolvedAt is set
  createdAt      DateTime     @default(now())

  @@index([jobId])
  @@index([conflictType])
}
```

Two fields this design needs added to existing models. On `GLink`, to make an
imported row traceable back to its legacy source and to detect `DUPLICATE_LEGACY_ID`
conflicts:

```prisma
model GLink {
  // ...existing fields unchanged...
  legacyId String? @unique // GLINKS record id, set only for imported rows; null for GCH-native links
}
```

On `Client`, to resolve a job's single destination client deterministically (see
[Granularity](#granularity)) rather than requiring the importer to infer it:

```prisma
model Client {
  // ...existing fields unchanged...
  legacyGlinksClientId String? @unique // the GLINKS-side client id this GCH Client was migrated from
}
```

## Open questions for review before schema work starts

- **Blocking:** the [governance prerequisite](#governance-prerequisite-this-needs-an-adr-not-just-doc-review)
  ADR does not exist yet. No schema work should start before it's approved, regardless
  of how settled the mechanism design below it is.
- Should a `COMPLETED` job with zero legacy records (an org with nothing to migrate)
  be distinguishable from one that imported records? Current design: both are
  `COMPLETED`; `importedCount` on the job row answers "how many," so no extra state
  is needed.
- `MigrationJob.cursor` (resume-from-last-page) is kept — it's now load-bearing for
  the stale-`RUNNING` reclaim path (see [Claim pattern](#claim-pattern)), not just an
  optimization, since a reclaimed job must resume from its last durably-processed page
  rather than restart from page 1.
- Conflict resolution's admin surface (who resolves `MigrationConflict` rows and
  through what endpoint) is explicitly out of scope here and needs its own design
  pass before `glink.import.conflict.resolved` can be implemented.
