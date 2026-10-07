# Commerce Phase 2 verification — 2026-10-07

PR #86 was merged before this phase. The follow-up is [PR #87](https://github.com/seerobshot-web/gc-hosting/pull/87). RP-dependent deals remain source-disabled, policy approval remains outstanding, and no production configuration was changed.

## Executed local checks

- All 252 API unit tests pass, with actual individual counts obtained using Node's `--test-isolation=none`. The normal runner passes all 36 spec files in isolated processes and now discovers nested specs that the shell's previous `src/**/*.spec.ts` expansion omitted.
- API and integration-fixture TypeScript checks, portal TypeScript checks, Astro check and changed API/integration lint pass. Astro reports zero errors/warnings and five existing hints.
- The complete sequence of eight migration SQL files applied successfully through the MySQL CLI to a new local MySQL 8.4 container. Its tables and commerce unique keys were inspected. This is SQL execution evidence, not a local Prisma migration-engine run.
- A wrong database name was rejected by the integration suite before connecting. The suite requires an explicit `COMMERCE_MYSQL_TEST=1`, a loopback hostname and the exact disposable database name `gch_commerce_test`.

Native Prisma engine downloads still return HTTP 403 in this workspace. The local compilation client remains the official generated client without native engines; native execution belongs to the CI result below, not the local mock tests.

## Native CI evidence

[PR #86 CI run](https://github.com/seerobshot-web/gc-hosting/actions/runs/37571263508) passed dependency installation, native Prisma generation, full workspace build, lint, typecheck and tests at commit `41ca3ec`. Its final result was failure because the production dependency audit failed. This closes the original uncertainty about the native build pipeline at that commit; it does not close the audit or demonstrate provider purchases.

[Commerce MySQL workflow](https://github.com/seerobshot-web/gc-hosting/actions/runs/37572071240) passed at commit `61cfce4`: native Prisma generated successfully, `prisma migrate deploy` applied all eight migrations, integration types passed, and all seven transaction tests passed with zero failures. Twelve concurrent deliveries of the same signed event produced one permanent claim, one paid audit and one durable job. A forced database write failure rolled back the claim and transition, and retrying the same event ID succeeded.

[PR #87 workspace CI](https://github.com/seerobshot-web/gc-hosting/actions/runs/37572071265) also passed native Prisma generation, the full workspace build, lint, typecheck and tests at `61cfce4`. That initial run failed its production dependency audit before the subsequent patch below.

The integration suite uses real MySQL transactions and real Stripe SDK signatures. Stripe payment reads and checkout identifiers are synthetic; SMTP is an in-memory recorder and guides/intake are generated fixtures. No RP adapter is called. Synthetic fixture policy flags are test inputs, not owner approval.

## Corrections accompanying verification

- Checkout and catalog availability require an allowlisted operator that still exists in the user database. Paid-order preflight holds if the operator disappears.
- Delivery queries exclude held/failed orders and already-delivered review jobs before applying their 50-row batch limit, with oldest eligible jobs first. The MySQL regression seeds more than fifty ineligible review jobs ahead of a new purchase.
- Disabling commerce also revokes private guide downloads.
- Malformed/truncated or unauthenticated intake ciphertext produces a controlled error without crypto exception details.
- Invalid checkout redirect URLs return to the unavailable page; unknown/unverified prices are omitted from Offer JSON-LD.

## Dependency correction

The current registry/advisory identifies `http-cache-semantics@4.3.0` as the patched release. It was verified as available, pinned through a workspace override, and installed. The local production audit now reports zero advisories. The full-scope audit reports one high and one moderate development advisory. Astro check/build and all eighteen web tests passed after the update. [Native workspace CI](https://github.com/seerobshot-web/gc-hosting/actions/runs/37572533889) passed at commit `fd40c41`, including installation, native Prisma generation, build, lint, typecheck, tests and production dependency audit. [MySQL verification](https://github.com/seerobshot-web/gc-hosting/actions/runs/37572533940) passed again after this patch, including all seven integration tests and all eight migrations. This is the final verified code commit; subsequent documentation-only edits do not change the implementation.

## Still required for the real staging purchase

The actual Stripe-test/RP-test paid-to-active purchase remains blocked by provider reference/mappings, per-item wholesale costs and billing cycles, the wallet/funds contract, staging credentials and approved policies. The MySQL suite does not validate RP price assertions, wallet holds, provider reconciliation, deployment polling, access links, credential reveal or renewal behavior. Those implementations still require verified provider evidence. Hostinger deployment/rollback and real SMTP delivery have not been exercised. After the dependency patch below, the full-scope audit retains one high (`braces`) and one moderate (`postcss-selector-parser`) in development dependencies. These remain open; production-audit success is not a claim that all dependencies are advisory-free. The registry still lists no `braces@3.0.4`; the selector-parser fix would cross an existing major-version dependency contract and was not forced without its own compatibility review.

No live charges, RP orders, production migrations or deployments were performed. No launch gates were waived.
