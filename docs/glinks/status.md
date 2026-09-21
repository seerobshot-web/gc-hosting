# GLINKS build handoff — 2026-09-13

Current project: C:\Users\Robbie\Downloads\GCH.
Branch: codex/glinks-foundation. Changes remain local and uncommitted.

## Completed in this pass
- Restored the project into the selected GCH folder.
- Reconstructed an exact shallow Git baseline at upstream commit
  33815a31c3d29a743da7c2432035c2b8f6e23f7a using authenticated GitHub metadata.
  Commit bytes, source tree and all 185 original file hashes were verified.
- Recovered the missing upstream video from the local GCH archive, with an exact Git hash match.
- Installed CodeIgniter 4.7.4 and Shield 1.4.1; generated composer.lock.
- Added Shield registration, password login, POST logout, session CSRF, auth throttling,
  local auth views, and a GLINKS-specific session cookie.
- Added workspace listing/creation, verified-session identity mapping, protected draft page
  reads, and tenant-scoped publication requests.
- Owner assignment occurs atomically when a workspace is created.
- Denied tenant requests return a uniform 404 with no tenant payload.
- Protected responses use private, no-store caching.

## Verification
- PASS: 16 domain checks.
- PASS: original SQL constraint suite on PostgreSQL 18.3 through PGlite 0.5.8.
- PASS: actual Shield/settings/GLINKS migrations through CodeIgniter against a disposable
  loopback PGlite socket server.
- PASS: 14 framework HTTP feature tests, 57 assertions. Includes anonymous denial,
  real Shield credential login, registration, wrong password, ownership injection,
  workspace owner creation, own-page publication, tenant/page ID substitution, viewer denial,
  editor publication, missing-CSRF denial, and rate limiting.
- Composer reported no dependency security advisories on installation.
- Native PostgreSQL two-connection ownership test is implemented in tests/concurrency.sh
  and wired into GitHub Actions, but has NOT been executed locally.
- PHP's built-in HTTP server still terminates before listening in this environment.
  The passing HTTP tests dispatch framework requests in-process; they are not browser tests.
- Docker Linux engine remains unavailable. Container build/start and native PostgreSQL
  concurrency are not verified.
- Existing GCH app suites are not revalidated.

## Route gate — CLEARED 2026-09-21
Native concurrency and live HTTP startup were independently re-verified locally (see
`docs/glinks/verification.md`, "Verified full pass on 2026-09-21") — the first local
run to get all the way through; every prior recorded attempt failed before reaching
native PostgreSQL or live HTTP serving. Two real bugs were found and fixed along the
way (a route-cache bug in `TenantHttpTest.php`'s `setUp()`, and a `.env`-shadowing
footgun in the verification scripts' override mechanism, now warned about in
`.env.example`) — this was not a rubber-stamp pass.
`Config/Glinks.php`'s class default (`ENVIRONMENT !== 'production'`) already reflects
the intended posture: open outside production, closed in it. There is no separate
runtime flag left to flip; the gate was procedural (don't build past this point until
verified), and it now is.

## Still to implement
Email verification and recovery, invitations, membership administration, workspace updates,
page/link editing, JSON import/export, public pages and redirects, analytics, media/OG,
video jobs and delivery, module publishing, verified domains, production serving,
backup/restore and retention.

## Resume
1. Composer install from composer.lock now passes; use docs/glinks/verification.md for the full sequence.
2. Run the native PostgreSQL workflow, especially tests/concurrency.sh, and verify live HTTP startup.
3. Enable protected routes only after those gates pass.
4. Implement and test email recovery and invitations, then page/link editing.

The local repository is shallow at the verified upstream commit. Parent history can be
retrieved later with git fetch --unshallow when the local Git network helper works.
Nothing was pushed and no cloud infrastructure was provisioned.

## Gate hardening follow-up
- Reconfirmed lockfile installation and the 16 domain checks.
- Concurrency now requires an observed PostgreSQL blocking relationship.
- Added live HTTP startup/readiness/closed-route checks to the native workflow.
- Both scripts pass Bash syntax validation; their native/live assertions remain unverified.
- Portable PostgreSQL 17.11 initialized, but its server exits before serving connections.
- PHP server startup still fails. The route flag remains closed.
- See verification.md for reproducible commands and exact local results.
