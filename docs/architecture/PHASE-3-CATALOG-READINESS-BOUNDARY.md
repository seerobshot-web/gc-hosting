# Phase 3 catalog and readiness boundary

## Reconciliation

The proposed prompt pack is guidance, not a provider or payment contract. The approved repository artifacts are the existing 18-item editorial allowlist in `apps/web/src/content/tools/toolEditorial.ts`, the pending mappings in `toolMappings.ts`, and the public projections in `toolCatalog.ts`. These already generate `/tools` and `/tools/[slug]`; no replacement catalog or duplicate data model is needed. All storefront paths, upstream identifiers, prices, and purchase flags remain blocked. The portal uses Next.js 15; the public catalog uses Astro.

PR #57's `apps/api/src/provisioning/phase3-contract-boundaries.ts` defines separately scoped product eligibility, Stripe payment observation, and ResellPortal fulfillment observation. Its `assessEntitlementReadiness` is a pure assessment and cannot grant an entitlement. The only approved inputs to the new read view are a tenant-scoped local order lookup and the explicit unconfigured observations. A local `PAID` or `ACTIVE` status does not verify payment or fulfillment.

## Read boundary

`GET /orgs/:orgId/orders/:orderId/readiness` uses the existing JWT guard and `provisioning:read` organization permission. The guard resolves live membership; the lookup also filters by `id` and `orgId`. An absent or cross-tenant order returns the same 404. The response contains local order status, false verification flags, a blocked readiness reason, and an internal correlation key. It excludes Stripe and provider identifiers and audit metadata. This view neither invokes nor enables checkout, recovery processing, provider calls, or entitlements.

The catalog tests assert that every public tool keeps pending identifiers, absent storefront paths, missing pricing, and a same-site contact path. The API tests assert guard metadata, tenant-scoped lookup and indistinguishable 404, blocked readiness even for a locally active order, and no sensitive identifiers in the projection. PR #57 has separate negative predicate and concurrent fixture tests; this view introduces no work claims or mutation concurrency. Concurrency of actual payment or fulfillment work remains a contract-gated concern.

## Outstanding approvals

The first sellable SKU and mapping, qualifying Stripe payment states and signed test fixtures, ResellPortal read and mutation schema with idempotency guarantees, and an approved entitlement policy remain unresolved. No provider or payment eligibility is inferred from this change. No live order, payment, provider mutation, database migration, deployment, or entitlement change was performed.
