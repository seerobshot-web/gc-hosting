# GLINKS by Glory Cloud Hosts

GLINKS is GCH's nonprofit link-in-bio and hosted-video product.
This CodeIgniter application lives inside the GCH monorepo at apps/glinks.

The tenant foundation and initial session-authentication slice are implemented.
Native PostgreSQL concurrency and live HTTP startup remain release gates.
**Normal tenant routes are disabled by default**; tests enable them through Config/Glinks.php.

See [architecture](../../docs/glinks/architecture.md),
[status and remaining work](../../docs/glinks/status.md), and
[local infrastructure](../../infra/glinks/README.md).

## Dependencies and checks
PHP 8.5 with intl, mbstring, PostgreSQL/PDO PostgreSQL, and Composer:
```sh
composer install
composer validate --strict
composer audit
php -n tests/domain.php
```

Use a fresh disposable PostgreSQL database named glinks_test.
Set database.default.* and database.tests.* to that test database (see .env.example).
Then:
```sh
psql "$GLINKS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql
php spark migrate --all
php vendor/phpunit/phpunit/phpunit tests/feature --no-coverage
bash tests/concurrency.sh
```
The SQL constraint test creates a schema and rolls back; run it before migrations.
The concurrency test refuses any database whose name is not glinks_test.
CI runs these checks on native PostgreSQL 17.

## Available in the test environment
Shield registration/login, POST logout, workspace list/create, private draft-page reads and
publication requests. Workspace roles are stored separately from Shield account groups.
A submitted role/user/workspace field never establishes authorization.
Only verified Shield session identities map to GLINKS principals.

Session cookies are host-only, HTTP-only and SameSite=Lax; Secure is enabled in production.
All mutations require session CSRF tokens. Auth endpoints are throttled.
Email recovery and verification are not implemented yet; magic-link routes are disabled.

Public pages, redirects, analytics and video hosting are not yet implemented.
No interface control claims those capabilities exist.
