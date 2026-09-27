# Audit read isolation: PR #60

## Finding and immediate fix

`GET /audit` previously returned recent rows across all organizations to any authenticated account. `AuditLog` has no `orgId` and its free-form metadata, actor, and target IDs are not trustworthy substitutes for tenant ownership. Adding a `WHERE` on JSON text or an inferred target would leak or omit data.

The existing URL now requires `org:read` with an explicit `orgId` query. The global JWT guard authenticates and `RolesGuard` checks live organization membership. Missing scope fails 400, unknown/inactive membership fails 404. After authorization, `AuditService.recentForOrg` fails closed with 503 and makes no read query. No existing audit rows are returned to any tenant, including the owner, until an authoritative tenant key is available.

## Verification and future enablement

Tests assert permission metadata, absent identity/scope denial, cross-tenant membership denial, equal no-data behavior for two authorized organizations, and zero calls to `auditLog.findMany`. This removes the cross-tenant disclosure without changing the write path or introducing a migration.

To restore audit listing: review an additive `orgId` column with safe backfill for every legacy actor/target type; quarantine ambiguous rows; index `(orgId, createdAt)`; select only scoped fields; add real HTTP integration tests for authorization and mixed-tenant rows; and perform a staged rollout. The route's current 503 is an intentional operational limitation. Rollback of this PR would reopen the leak; retain the deny response until the replacement is verified.

No fulfillment, Stripe, ResellPortal, Hostinger, deployment, or database mutation is included.
