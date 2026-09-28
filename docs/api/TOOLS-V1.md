# TOOLS v1 — public read-only API

## Launch boundary

TOOLS v1 is a public discovery surface only. It exposes GCH-owned editorial
catalog metadata and deliberately does **not** expose or invoke purchase,
payment, entitlement, provisioning, or provider-write behavior.

The ResellPortal catalog adapter remains unwired because the repository does not
verify its public catalog route, response schema, pagination semantics, status
enums, or storefront mappings.

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /v1/tools`
- `GET /v1/tools/:slug`

`/v1/tools` and `/v1/tools/:slug` are public and rate-limited to 30 requests
per minute per IP. Global CORS remains an explicit allowlist from
`ALLOWED_ORIGINS`; no wildcard origin is introduced.

## Public response contract

Each tool exposes only:

- `slug`
- `displayName`
- `category`
- `audience`
- `teaser`
- pricing state/value
- availability state/value
- `purchase.enabled`

For this launch:

- pricing state is always `missing`
- availability state is always `unknown`
- `purchase.enabled` is always `false`
- upstream product IDs/keys, storefront paths, provider credentials, payment
  state, entitlement state, provisioning controls, and raw provider responses
  are not part of the public schema

The runtime catalog is validated with Zod at module load. Unknown slugs return
404. Malformed slug parameters are rejected by the global validation pipe.

## Authority boundaries

- Stripe owns payment state.
- ResellPortal owns catalog, fulfillment, and provisioning.
- GCH owns orchestration, entitlement, audit history, and this editorial public
  projection.
- Unknown or unverified upstream state remains unknown and cannot enable
  purchase.

## Deployment checks

Before production release:

1. build, lint, typecheck, tests, dependency audit, and CodeQL pass;
2. CORS allowlist contains only approved origins;
3. smoke test `/health`, `/ready`, `/v1/tools`, a valid slug, an unknown
   slug, and rate limiting;
4. confirm responses contain no upstream IDs, credentials, storefront paths, or
   payment/provisioning state;
5. confirm the web catalog still renders Contact GCH rather than Purchase for
   every current tool.
