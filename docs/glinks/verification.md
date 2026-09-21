# GLINKS native verification gate

Run from apps/glinks with PHP 8.5, Composer, Bash, curl and native PostgreSQL client tools.
Use a disposable database named glinks_test. Never point these checks at tenant data.
PGlite feature tests do not establish native concurrency.

Configure database_default_* and database_tests_* environment variables for that database,
plus GLINKS_TEST_DATABASE_URL. The GitHub workflow contains an isolated service example.
Use development for the CLI migration environment. Keep glinks.enableTenantRoutes=false.

Run in order:

```sh
composer install --no-interaction --prefer-dist
composer validate --strict
composer audit
php -n tests/domain.php
psql "$GLINKS_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f tests/database.sql
php spark migrate --all
php vendor/phpunit/phpunit/phpunit tests/feature --no-coverage
bash tests/concurrency.sh
bash tests/http-startup.sh
php spark routes
```

The SQL suite expects an empty disposable database. Recreate the disposable database
before repeating the full sequence; the application migration intentionally has no destructive down().

The concurrency script must observe the second owner's transaction blocked by the first
using pg_blocking_pids, then prove that only one demotion commits and one owner remains.
A missing overlap is a failure, even if the final owner count is correct.

The HTTP script starts its own loopback PHP development server on port 18091, checks JSON
health responses, database readiness and no-store caching, and requires gated tenant URLs
to return 404. Set GLINKS_HTTP_TEST_PORT to another unused port if needed.
It stops its server on exit and records writable/logs/http-startup.log.
The workflow uploads that log on failure.

Passing this check establishes development-server startup, not Docker or production PHP-FPM
readiness. Record the tested commit, runtime versions and complete results before choosing
to enable protected routes. The scripts never change the saved route flag.
Recovery, invitations and page editing remain subsequent implementation steps.

## Local attempt on 2026-09-13

- Composer installation from the existing lockfile completed successfully.
- The 16 domain checks passed again.
- Both Bash scripts passed syntax validation.
- Official EDB PostgreSQL 17.11 Windows binaries were downloaded into ignored work/.
  Archive SHA256: 4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf.
  This hash records the downloaded artifact; no separately published checksum was verified.
- Native postgres and initdb reported 17.11. initdb completed an isolated cluster.
- Both pg_ctl startup and direct postgres startup exited with code 1 before serving,
  without a useful server log.
- PHP's built-in HTTP server again exited with code 34209999 before listening.
- Native database execution, concurrency and live HTTP assertions remain UNVERIFIED.
  Tenant routes remain disabled. No infrastructure was provisioned or changes pushed.

Source for the portable runtime: [EDB PostgreSQL binaries](https://www.enterprisedb.com/download-postgresql-binaries).

## Verified full pass on 2026-09-21

Ran the complete sequence above end-to-end on native Linux (PHP 8.4.19 — composer
required `--ignore-platform-req=php` since composer.json pins `^8.5`; PHP 8.5 itself
could not be installed in this environment because the package mirror was blocked, so
this is not yet a PHP-8.5-exact run) with native PostgreSQL 16.13 (not 17, for the same
package-availability reason). Commit `b4c4b73` (the current `main` HEAD at the time).

- `composer install`, `composer validate --strict`, `composer audit`: all clean.
- `php -n tests/domain.php`: PASS, 16/16 domain checks.
- `psql -f tests/database.sql` against a freshly recreated `glinks_test`: PASS, rolls
  back cleanly.
- `php spark migrate --all` against `glinks_test`: all 7 migrations applied (Shield
  auth tables, Settings x3, `CreateGlinks`, `CreateAccountTokens`, `AddDraftVersion`).
  Note: `spark migrate -g tests` (the documented `-g` group flag) did **not** actually
  target the `tests` connection in this environment — it kept writing to the `default`
  group's database regardless of the flag. Worked around by temporarily pointing
  `database.default.*` at `glinks_test` for the migration run only, then restoring
  `.env`. Worth a closer look before relying on `-g` elsewhere.
- `php vendor/phpunit/phpunit/phpunit tests/feature --no-coverage`: **found and fixed
  a real bug.** All 24 runnable tests failed with `PageNotFoundException` on every
  gated route (only the 2 domain-layer tests that don't go through HTTP passed).
  Root cause: `RouteCollection::loadRoutes()` caches `Config/Routes.php`'s output for
  the life of the process (`didDiscover`); CodeIgniter's test bootstrap triggers that
  first load before any test's `setUp()` runs, while `Config('Glinks')->enableTenantRoutes`
  is still at its `.env`-sourced default — so the route table locks in "closed" for
  the entire PHPUnit run regardless of what individual tests set afterward. Fixed by
  adding `service('routes')->resetRoutes();` to `TenantHttpTest::setUp()`, right after
  the config flag is set, forcing a fresh (correctly-gated) route load per test. After
  the fix: 24/24 runnable tests PASS, 119 assertions, 2 skipped (the two
  `GLINKS_SMTP_TEST`-gated cases, not run locally without Mailpit).
- `bash tests/concurrency.sh`: PASS — native `pg_blocking_pids` overlap observed,
  exactly one owner survives concurrent demotion. This is the first locally-confirmed
  pass of this check; every prior recorded local attempt failed to even get native
  PostgreSQL serving connections.
- `bash tests/http-startup.sh` (closed, then open): **found and fixed a second bug**,
  same root cause pattern as the routing one. `BaseConfig`'s env-value resolution
  checks a config property's *dotted* `.env` form (`app.baseURL`, `glinks.enableTenantRoutes`)
  before the *underscore* form a shell-level override must use (bash can't have dots in
  a variable name) — so a `.env` copied from `.env.example` (which sets both dotted
  keys) permanently shadows this script's `app_baseURL=... glinks_enableTenantRoutes=...`
  per-process overrides, in both directions. Concretely: the "open" mode check's login
  redirect pointed at the `.env`'s static `app.baseURL` (`http://localhost:8088/`)
  instead of the test server's actual ephemeral address, and no override could ever fix
  that while those two lines stayed in `.env`. Fixed locally by removing both lines
  from the local `.env` (not `.env.example` — see below) and letting the script's
  overrides be the sole source. After the fix: both closed and open modes PASS.
  **This is why the CI workflow (`.github/workflows/glinks.yml`) never hit it**: it
  never creates a `.env` file at all, so there's no dotted value to shadow anything.
  Any contributor who copies `.env.example` to `.env` for local verification (as this
  doc's own instructions say to) hits this immediately — worth fixing in
  `.env.example` or the scripts themselves rather than requiring every contributor to
  rediscover this.
- `php spark routes` (tenant routes open): lists the full gated route table as
  expected; no anomalies.

Net result: the native-concurrency and live-HTTP-startup gates that blocked tenant
routes are now independently verified locally (previous attempts never got this far),
with two real bugs fixed rather than papered over. Neither bug is specific to this
environment — the routing one will hit any contributor's first PHPUnit run, and the
`.env`-shadowing one will hit any contributor who follows this doc's own setup
instructions literally.

