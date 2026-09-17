# GCH Public Marketing — Production Hardening: Routes + Content Sources

Status: first hardening pass after the 35-journey wireframe implementation.

## Objectives

1. Eliminate navigation paths that resolve only as conceptual placeholders.
2. Give every primary public route an owned Astro page or an explicit bridge contract.
3. Centralize public route definitions so navigation and CTAs do not drift independently.
4. Separate approved/repository-backed content from catalog-controlled or editorial-draft content.
5. Remove plan entitlements, pricing signals, resource metadata, and availability claims that are not supported by an authoritative source.

## Route contract

| Route | Owner | Current state | Production requirement |
|---|---|---|---|
| `/` | `apps/web` | Valid | Public homepage |
| `/marketing` | `apps/web` | Valid | Expand from approved marketing content |
| `/ministry` | `apps/web` | Valid | Expand from approved ministry content |
| `/hosting` | `apps/web` | Valid | Bind commercial claims to catalog/hosting source data |
| `/tools` | `apps/web` | Valid | Bind availability and pricing to canonical catalog |
| `/resources` | `apps/web` | Valid | Publish only approved resources; draft briefs are visibly identified |
| `/start` | `apps/web` | Valid | Solution Finder entry point |
| `/portal` | bridge | Valid bridge | Set `PUBLIC_PORTAL_URL` to authoritative portal deployment |
| `/dashboard-preview` | `apps/web` preview | Valid | Review-only; not a customer sign-in substitute |
| `/marketing-foundation` | `apps/web` preview | Valid | Design-system/journey review surface |

Route definitions live in `apps/web/src/config/site-routes.ts`.

Run the static validator with:

```bash
pnpm --filter @gch/web validate:routes
```

The validator checks registered route files and literal root-relative `href` values in the web source tree. Dynamic destinations still require review at integration boundaries.

## Content-source contract

Public content provenance is represented in `apps/web/src/content/marketing-content.ts`.

### Approved positioning

Use for mission, category positioning, and high-level GCH value propositions that have already been approved for the public marketing system.

### Repository-verified sources

`docs/marketing/PUBLIC-MARKETING-WIREFRAME-MATRIX.md`
- interaction architecture
- visual-family rules
- accessibility expectations
- journey definitions

`blueprints/website-builder/README.md`
- AI Website Builder delivery workflow exists
- tier names `SEED / FRUIT / HARVEST / LABORER` are referenced
- does **not** establish public pricing or a complete entitlement matrix

### Canonical catalog required

The GCH product/catalog authority must supply:
- sellable product status
- package membership
- plan entitlement inclusion/exclusion
- plan limits
- prices and currencies
- billing intervals
- promotions
- checkout mapping
- contractual availability

Stripe remains billing authority and ResellPortal remains fulfillment authority; neither should be used as a substitute for approved public product copy.

### Editorial resource queue

Resource ideas may exist as briefs, but the public site must not invent:
- publication URLs
- article body claims
- authors
- dates
- read times
- downloadable assets

The `/resources` route currently exposes draft briefs explicitly as draft/source records.

## Hardening changes in this pass

- Added typed public route registry.
- Added valid `/marketing`, `/ministry`, `/hosting`, `/tools`, `/resources`, `/start`, and `/portal` routes.
- Replaced obsolete homepage links (`/ai-tools`, `/design-marketing`, `/ministry-education`) with the validated public IA.
- Changed Portal navigation from a fake in-app sign-in assumption to a bridge route controlled by `PUBLIC_PORTAL_URL`.
- Removed invented SEED/FRUIT/HARVEST/LABORER feature inclusion claims from the plan matrix. Tier names remain; entitlements now read `To verify` until canonical catalog data is available.
- Replaced invented resource read-time metadata with editorial/source status.

## Next hardening gates

1. Merge/resolve the open commercial-decision PR, then retarget this hardening PR to `main`.
2. Run `validate:routes`, `typecheck`, `lint`, and build in CI/local workspace.
3. Connect canonical catalog data to plan/product surfaces.
4. Verify the actual customer portal deployment URL and set `PUBLIC_PORTAL_URL`.
5. Inventory every remaining CTA and classify it as public route, portal route, external demo, checkout, or unpublished placeholder.
6. Replace review-only abstract media with approved assets and documented alt-text decisions.
7. Promote the final approved journey composition from `/marketing-foundation` into the production homepage intentionally rather than by copy/paste.
