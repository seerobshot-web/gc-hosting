# PR #62B — audit migration approval criteria (schema and DDL blocked)

**Decision date:** 2026-09-27. **Scope:** approval record only. No Prisma schema change, migration, database scanner, backfill, route change, or test fixture was added. The user's instruction to approve evidence-supported decisions is recorded here. It does not supply an operational inventory, choose an FK delete rule, or approve unknown historical action–target semantics.

## Approval sources and how to read this gate

- [PR #62A](https://github.com/seerobshot-web/gc-hosting/pull/62) is merged, but explicitly calls its design BLOCKED and requests later decisions; a merge is not an approval of DDL.
- At inspection, PR #62A had no APPROVED review and no issue comments. A COMMENTED bot review identified two necessary corrections: [validate action–target pairs](https://github.com/seerobshot-web/gc-hosting/pull/62#discussion_r4114812189) and [require scoped writer cutover before read rollout](https://github.com/seerobshot-web/gc-hosting/pull/62#discussion_r4114812192). Verify current comment URLs if IDs change. Neither grants permission to generate SQL.
- The current user explicitly requests approving missing decisions *if they align*; this authorizes recording compatible design constraints below, but does not provide missing facts or a choice of delete action. "Approved (design constraint)" is not a passed mandatory migration gate.

| # | Mandatory decision | Evidence location / status | Required resolution |
| --- | --- | --- | --- |
| 1 | Complete ownership matrix for every actual action–target shape | **BLOCKED.** PR #62A matrix is a candidate. `audit-ownership.plan.ts` accepts any nonempty action with a broadly supported target; review identified unapproved pairs. | Inventory actual action–target pairs without identifiers, approve an allowlist and unknown-pair quarantine; test `order.paid → Org` and arbitrary actions. |
| 2 | Authoritative relation for each supported shape | **PARTIAL design approval, gate BLOCKED.** `schema.prisma` and PR #62A document FK-backed candidates, but no reviewer approved each event meaning. | Sign off each approved event and surviving FK path, including GLink double-check; provider IDs and metadata excluded. |
| 3 | Deleted targets | **Approved preservation rule; semantics BLOCKED.** User requires no guessed ownership and PR #62A describes removed membership/domain rows. | Approve event-specific `orphaned` vs `unsupported_event_shape` where targets no longer exist. Keep both unassigned meanwhile. |
| 4 | Conflicting candidates | **Approved design constraint.** User prohibits guessing; PR #62A matrix marks mismatched GLink paths and existing-scope mismatches ambiguous. | Record owner sign-off before any write path; no first-match tie break. |
| 5 | Foreign-key target | **Approved design candidate:** `AuditLog.orgId → Org.id` aligns with the inspected tenant key and user's conditional approval. **DDL gate still blocked.** | Confirm with schema owner in the same review as delete action and migration. |
| 6 | Foreign-key delete action | **NOT APPROVED.** PR #62A explicitly refuses to choose RESTRICT vs SET NULL; existing MySQL migrations use both for other relations. | Security/data-retention owner chooses and signs off exact action, deletion semantics and test fixtures. Do not infer a default. |
| 7 | New writer orgId policy | **Approved constraint:** scope only from authoritative server-side relation; preserve existing writes in schema-only PR. **Cutover gate BLOCKED.** | Inventory `AuditService`, all callers and direct cron writer; approve writer rollout and tests *before* scoped reads. The bot review noted this missing release step. |
| 8 | Future scoped read query | **NOT APPROVED.** `audit.service.ts` always returns 503 and performs no row read. | Review tenant-filtered projection, sort direction, stable tie-breaker, cursor and bounds. Keep route disabled until independently reviewed backfill. |
| 9 | Supporting index | **NOT APPROVED.** `(orgId,createdAt,id)` is only a proposal; no scoped query or MySQL plan. | Approve index against query #8 with representative EXPLAIN and DDL cost; no speculative index. |
| 10 | Execution and rollback ownership | **NOT FOUND.** No named operator, verified backup/restore drill, MySQL version/table size or lock budget supplied. | Record named migration and rollback owners, maintenance/abort conditions, backup, verification and forward-repair procedure. |
| 11 | Disposable DB evidence | **NOT FOUND.** CI generates Prisma and runs tests, with no isolated MySQL migration job visible; `backfill-identity.ts` is a write script, not disposable audit infrastructure. | Supply verified disposable isolated MySQL creation, bounded fixtures, redacted URL, migration test command and teardown proof. |
| 12 | Nonassignable rows preserved/inaccessible | **Approved design constraint.** User explicitly requires ambiguous, orphaned, invalid and unsupported rows remain unassigned; PR #62A calls for nullable storage and unchanged 503. | Tests must show no assignment/deletion; retain the constraint through all later reviews. |

**Gate result: FAIL / BLOCKED.** Approval of design constraints #4, #5, and #12 and preservation portions of #3 and #7 does not waive incomplete items. No schema or migration may be generated until all twelve decisions have an explicit recorded reviewer sign-off and missing operational evidence is supplied.

## Verified repository context

`packages/database/prisma/schema.prisma` defines `AuditLog` without `orgId` and `Org.id` as tenant PK. The six checked migration SQL files and `migration_lock.toml` use MySQL, with differing delete actions on other FKs. `AuditService.logAction` writes via Prisma; `recentForOrg` always raises 503. `AuditController`, `RolesGuard`, and `TenancyService` require explicit org scope and active membership; `audit.controller.spec.ts` tests the 400/404/503 boundary and zero audit reads. PR #61 fixture classifier has no database resolver. Direct cron write exists in `workers/cron-jobs/src/resellportal-poller.ts`. The six Prisma migrations contain no audit tenant-key migration. No standalone audit repository or disposable MySQL setup appears in the inspected repository tree; this does not establish anything about infrastructure outside this repository.

**Known limitations to keep separate:** `apps/api/src/auth/jwt.strategy.ts` does not configure issuer/audience; no values are approved. `workers/cron-jobs/src/audit-integrity-check.ts` has an unbounded deployed-order query and logs gap order IDs. Address both in separate reviewed changes.

## Proposed fixtures and tests (not implemented or run by this PR)

1. Approval-gate fixtures: absent decision, merge-only evidence, COMMENTED review, generic "approved" wording, mismatched action–target, partially approved relation, missing operational inventory; each blocks migration generation and identifies its missing item.
2. Ownership fixtures: deleted membership/domain, missing order/client/provider service, conflicting GLink paths, existing scope mismatch, invalid row, unknown target, known target with unknown action, metadata/actor spoof; none silently assigned.
3. Future isolated MySQL tests: legacy audit row with content unchanged; nullable new key; exact approved FK target and delete behavior; index matching approved query; no historical updates/deletes or backfill; rerun from disposable clean state; content-preserving rollback or approved forward recovery.
4. PR #60 regressions: missing org 400; nonmember 404; authorized 503; no audit-row reads or cross-tenant disclosure. Writer tests for every approved server-side scope path and direct cron write.
5. Dry-run tests only after separate design approval: bounded take/total, stable cursor, concurrent runs, zero writes, aggregate-only output, and no sensitive identifiers.

No test fixture code is added because this PR's mandated blocked branch permits **approval-criteria documentation only**.

## Execution and review order

Approve complete action–target/ownership matrix and deleted/conflict policies → choose FK target/delete action and writer policy → approve future query/index → supply database inventory, named operators and disposable test setup → independently review an additive nullable migration PR → test only in verified disposable MySQL → separately approve and run production migration → separately approve bounded aggregate dry run and review results → separately approve conditional backfill and writer cutover → independently review tenant-scoped reads. Publication or merge of this checklist does not satisfy an outstanding approval.

**Current rollback boundary:** revert this documentation commit; no SQL or database state exists to reverse. Future DDL rollback must be designed before execution, preserve original audit fields, never auto-drop populated scope, and retain PR #60's 503 throughout.

**Security and side effects:** documentation changes introduce no browser bundle, Next/Astro output, NEXT_PUBLIC secret, source map, executable SSRF/XSS/CSRF/CORS/redirect/SQL/IDOR path, logging change, migration lock, dependency or lockfile change, payment/provider operation, deployment, entitlement or database connection. Existing JWT and worker findings remain open. No production or disposable DB was accessed.

## Evidence request to reviewers

For each row #1–#12, provide an explicit decision with named reviewer and link to approved policy or test artifact. Supply a sanitized table-size/index and MySQL-version inventory, backup/restore proof, safe DDL timing and lock limits, approved future query/EXPLAIN, and a disposable MySQL setup with teardown evidence. Record the approved retention/delete behavior. Resolve the action–target allowlist and writer-cutover review comments. Do not post credentials, customer IDs or raw audit rows.

## Handoff prompt

In `seerobshot-web/gc-hosting`, first reconcile PR #62A and this #62B gate. Obtain explicit recorded approvals for all twelve decisions, including action–target semantics, FK deletion, future scoped query/index, named migration/rollback owners and verified disposable MySQL evidence. Until complete, edit **approval criteria only**. After approval, prepare an additive nullable `AuditLog.orgId` schema/migration for review, test only with isolated disposable fixtures, and leave `GET /audit` at 400/404/503 and zero audit reads. Do not execute production DDL, backfill, provider/payment/deployment/fulfillment/provisioning/entitlement work, or guess unknown contracts. Stop and report any missing evidence.
