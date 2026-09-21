# GLINKS local infrastructure

**Development only.** The app currently exposes /health/live and /health/ready.
The PHP development server is not a production serving configuration.

From this directory, create .env from .env.example and set a unique local password:
```sh
docker compose --env-file .env up --build -d
docker compose --env-file .env exec app php spark migrate --all
```
Open http://localhost:8088/health/live and http://localhost:8088/health/ready.
Readiness returns 503 until database configuration and migrations work.

The optional mail profile exposes its inbox at http://localhost:8028.
Start it with `docker compose --env-file .env --profile mail up -d`.
No email-dependent auth workflow exists yet.

The service name and volumes are isolated from the existing GCH/FOSSBilling stack.
Do not run `docker compose down -v` unless deliberately discarding the local database.
The migration down() intentionally refuses destructive rollback.

## Before production
Install from the generated composer.lock, verify dependency
security advisories, and pin tested container digests. Local image tags are development
defaults, not a reviewed production bill of materials.
Replace spark serve with PHP-FPM, use HTTPS-only cookies, configure trusted proxies, and
separate the migration owner from a least-privilege runtime database role.
No database is published to the host in this Compose file.

Backup and restore are still implementation tasks. A launch gate must prove PostgreSQL
restore plus media restore into an isolated environment, verify publications/media checksums,
and document recovery time. A volume by itself is not a backup.

No cloud resources, production domains, or existing GCH deployments were modified.
