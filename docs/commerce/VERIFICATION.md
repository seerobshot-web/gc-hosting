# Prepaid commerce verification — 2026-10-06

## Source and local checks

The shared catalog contains the owner's confirmed yearly retail totals and the ten uploaded guides' product lists. The nine RP deals remain source-disabled; no retail discount schedule is used. Uploaded PDFs are private local assets, excluded from Git and public builds.

Local API suite: 249 tests pass, including real Stripe SDK signature generation/verification without network, unpaid ACH completion, async success, payment binding mismatch, replay claim, global kill switch, unresolved-provider hold/alert behavior, refund holds, current charge refund/dispute re-verification, customer-owned listing, encrypted intake/tamper detection, signed private guide links, and RP error-body redaction. These are unit tests with mocked persistence/provider calls, not Stripe/RP purchases or database concurrency evidence.

Catalog suite: four tests pass. Web catalog suite: 18 tests pass. Public route validation passes for 16 registered routes. Direct Astro and Next.js builds pass, and direct API TypeScript compilation passes. All nine workspace source typechecks and lint tasks pass using Turbo `--only --env-mode=loose` (45 pre-existing lint warnings, no lint errors). Full default Turbo checks remain blocked because their dependency build step attempts native Prisma generation; a successful `pnpm build/typecheck/lint/test` pipeline is not claimed. The generated client workaround was local and uncommitted. Node test suites ran with `--test-isolation=none` to obtain actual individual assertion counts in this workspace. New Deals text has Hearth Ink/Cloudlight contrast 13.76:1 and Ember Core/Cloudlight link contrast 5.57:1; both exceed WCAG AA for normal text. No placeholder social proof was added.

## Environment limitations

Native Prisma engine downloads returned HTTP 403 from the engine distribution host. For source compilation and mock-only tests, a genuine Prisma 5.22 client was generated from the full schema using its official WASM DMMF and generator, without copying native engines. This local, uncommitted workaround is not a deployable database client and does not prove SQL migration/runtime behavior. Normal native generation and a disposable MySQL migration are still required in staging/CI.

Stripe test credentials, RP credentials, DATABASE_URL and SMTP credentials are absent from this workspace. No live Stripe/RP requests, real charges, provider orders, production migrations, deployment settings or mail sends occurred. No Stripe test purchase occurred either. The submitted code rejects live Stripe keys/events and cannot order RP deals.

## Dependency audit

Patched the available `source-map-js` and `sharp` releases via workspace overrides. The re-run audit reports two high advisories (`http-cache-semantics`, `braces`) and one moderate (`postcss-selector-parser`). The reported patched versions for the first two were unavailable from the configured registry: npm returned no matching `http-cache-semantics@4.2.1` or `braces@3.0.4`. They remain open. The selector-parser remediation spans an existing major-version contract and was not forced through as an unverified transitive upgrade. No audit-pass claim is made.

## Launch gates still open

- RP hosting-tier field, AI IDs, actual order/service response contract and reconciliation identity.
- Verified per-item monthly/annual wholesale costs and first-debit wallet requirement; aggregate annual budgets are insufficient evidence.
- Wallet funding/insufficient-funds behavior, price assertions, automated multi-item RP fulfillment, polling, access links/secure credential reveal, renewal calendar and cancellation process.
- Sales tax, refund policy, receipt branding, and replacement of pending legal pages with approved content.
- Actual staging signed webhook/replay and paid-to-active purchase; low-wallet hold; kill switch under real staging traffic.
- Disposable MySQL migration and concurrent transaction evidence; native Prisma-supported workspace build.
- Actual Hostinger deployment, health checks and rollback. Remaining dependency advisories.
- RP storefront manual-payment placeholder removal/verification and separate-channel listing review.

No gates are waived. The PR provides a guarded prepaid foundation and a human-service test path; it does not complete the requested RP implementation or end-to-end Phase 2 purchase. Those depend on the unresolved evidence/configuration above.
