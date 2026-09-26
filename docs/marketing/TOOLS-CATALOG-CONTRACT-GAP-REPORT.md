# GCH Tools Catalog Phase 1 — Contract Gap Report

Status: repository-verified on 2026-09-26.

## Responsibility mapping in the actual repository

| Intended responsibility | Actual repository owner | Notes |
| --- | --- | --- |
| Public marketing site and `/tools` routes | `apps/web` (Astro) | The Astro app already owns `/tools`; this phase replaces the placeholder route with a data-driven catalog and detail pages. |
| Customer portal | `apps/portal` (Next.js App Router) | The portal is a separate authenticated app, not an Astro subsection. |
| Server-side integrations and authority orchestration | `apps/api` (NestJS) | Existing ResellPortal integration lives under provisioning today; this phase adds a read-only catalog scaffold under `apps/api/src/integrations/resellportal/`. |

## Verified facts from repository artifacts

- `apps/web/src/config/site-routes.ts` is the base-aware route helper for public links.
- `apps/api/src/config/env.schema.ts` is the startup env-validation boundary for the API.
- `apps/api/src/provisioning/resellportal.client.ts` is the current ResellPortal adapter and confirms existing server-side credential usage for provisioning flows.
- `docs/architecture/AUTHORITY-BOUNDARIES.md` keeps billing with Stripe, fulfillment with ResellPortal, and orchestration with GCH.

## Differences from the intended design

1. The repository does **not** already have an `apps/api/src/integrations/` tree, so this phase introduces the read-only catalog scaffold there while leaving the existing provisioning adapter untouched.
2. The current `/tools` route is a placeholder landing page, not a product catalog.
3. The repository includes public route hardening guidance, but the static route validator script was already broken before this phase and had to be repaired to make route checks useful again.
4. The portal remains a separate Next.js app; no authenticated catalog or purchase flow is moved into Astro in this phase.

## Catalog contract gaps that remain

The repository does **not** verify the following ResellPortal catalog facts:

- the read-only catalog endpoint path
- request query parameters
- response schema and pagination
- price, billing-cycle, and availability field meanings
- public storefront identifiers and safe storefront destinations

Because those facts are not repository-verified, Phase 1 keeps:

- `orderEnabled` false for every tool mapping
- public pricing in a withheld state
- public availability in a contact-led state
- all catalog behavior read-only, server-side, and contract-gap guarded
