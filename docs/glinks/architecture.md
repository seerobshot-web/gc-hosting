# GLINKS architecture decision record

Date: 2026-09-13. Status: foundation and first authentication slice implemented; native concurrency/startup gates pending.

> **2026-09-21 update.** This document's "Repository choice" section below records a
> now-superseded decision: `apps/glinks` originally landed in `seerobshot-web/gch_alep2`.
> Per `seerobshot-web/gc-hosting`'s own README ("Canonical GCH-ALEPH repository"),
> `gc-hosting` is the canonical repository for GCH-ALEPH core work as of 2026-09-17, and
> `gch_alep2` is legacy/frozen except for bounded preservation work. `apps/glinks`
> (with `docs/glinks/` and `infra/glinks/`) was ported here on 2026-09-21, at the commit
> where the native verification gate below was first cleared (see
> `docs/glinks/verification.md`, "Verified full pass on 2026-09-21"). The rest of this
> record is kept as-written for history; read "apps/glinks" throughout as relative to
> `gc-hosting`'s root, not `gch_alep2`'s.

## Repository choice (historical — see update above)
Selected seerobshot-web/gch_alep2 over gch_alep. The reviewed README and package manifest
show GCP Cloud Run/Cloud SQL/Compute deployment infrastructure and newer Node/pnpm/ESLint
tooling. This is evidence of a more developed foundation, not evidence that production is
deployed or that every existing GCH feature works.

Source commit: 33815a31c3d29a743da7c2432035c2b8f6e23f7a.
The local Git network helper failed, so files were retrieved using the connected GitHub API.
The complete baseline was subsequently reconstructed as an exact shallow Git repository. The missing video was recovered from a local archive with a matching Git hash. Parent history is intentionally outside the shallow boundary; GLINKS additions remain uncommitted on codex/glinks-foundation.

## Application boundary
GCH retains storefront, client portal, operations and FOSSBilling provisioning.
GLINKS is an independent PHP modular monolith under apps/glinks, following the supplied
GloryLink PHP/CodeIgniter handoff. It has a dedicated PostgreSQL database and independent
migration lifecycle. GCH supplier secrets, billing cookies, and billing tables are not shared.

The repository's TypeScript environment-reader and zod rules continue to apply to GCH code.
PHP uses CodeIgniter configuration and typed server-side validators instead. The parent
repository's earlier “TypeScript layer only” description is superseded specifically for
this user-authorized PHP application. No supplier integration changes are part of this slice.

## Ownership
Workspace = tenant. User = mapped verified authentication identity.
Membership = owner/editor/viewer. A user can have memberships in multiple workspaces.

Every page, link, publication, click, module, media relation and domain has an explicit
workspace relationship. Composite foreign keys prevent connecting records across tenants.
Foreign keys do NOT authorize reads: every protected repository operation must enforce
membership and workspace predicates. Row-level security is not currently enabled.
Do not market this scaffold as verified tenant isolation until HTTP and database tests pass.

Membership changes lock the workspace. Deferred constraints prevent an ownerless workspace
at transaction commit, including creation. Publication locks the same workspace before
checking current membership to serialize against removal/demotion.

## Publication
The draft lives on the page; stable link records retain IDs and never reuse deleted slugs.
Each publication stores an immutable JSON snapshot. The page points to one publication
with a composite foreign key. No public route is implemented yet.
Public rendering, redirect resolution, metadata and OG generation must all read the same
snapshot. Cache keys must include workspace, page, publication and theme version.
Unpublish must clear the pointer and invalidate cached public content.

## Modules and video
Module kinds: links, video, gallery, events, devotional, testimonials, giving.
Giving is an external action, not payment processing.
Explicit module_media relationships enforce same-workspace asset references.
The JSON content column is not permission to reference arbitrary asset IDs: future validators
must resolve every reference through the explicit relationship.

Video release requirements:
- Tenant-scoped original uploads, validated type/size/duration and reserved storage quota.
- A durable job/outbox with retries, idempotency keys, terminal failure states and cleanup.
- Separate constrained FFmpeg worker; no transcoding in a web request.
- Derived poster, browser-compatible playback rendition, captions and measured storage use.
- Private originals and controlled delivery of assets referenced by current publications.
- One video: flush player. Multiple: latest player plus 3-column desktop / 2-column mobile grid.
- Accessible overlay with focus management, Escape close, pause on close and no autoplay.
- Authenticated preview, clear publication semantics and no visitor identifiers in playback logs.

Only the media/module schema exists in this slice. It does not yet provide video hosting.

## Infrastructure
infra/glinks/compose.yaml is local-only: loopback web port, private database network,
separate persistent volumes and optional development mail viewer.
It does not amend the GCH Cloud Run Terraform.
Production design is PHP-FPM + Caddy, dedicated PostgreSQL runtime/migration roles,
persistent media or object storage, a worker, scheduled retention, backup/restore tests,
and an explicit domain/TLS allowlist. Production manifests and managed cloud resource
provisioning remain later work. Never place media on Cloud Run ephemeral disk.

## Planned delivery order
1. Run migrations, database/concurrency tests and complete Shield authentication/onboarding.
2. Tenant dashboard, workspace switching, invitations, draft links and JSON import/export.
3. Public SSR page, publish/unpublish and first-party redirect tracking with bounded failure.
4. Analytics, avatar validation, OG assets and retention.
5. Video upload/processing/delivery plus the remaining module renderers.
6. Backup/restore, deployment hardening, verified custom domains.

No billing, commerce, platform impersonation or supplier provisioning is added to GLINKS.

## Primary references
- https://codeigniter.com/user_guide/installation/installing_composer.html
- https://github.com/codeigniter4/appstarter/tree/v4.7.4
- https://github.com/codeigniter4/shield
