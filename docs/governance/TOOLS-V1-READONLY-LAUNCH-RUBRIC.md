# TOOLS v1 Read-Only Launch Rubric

## Launch definition

**TOOLS v1 = public catalog + documented read-only API + contact/request-access conversion path.**

No checkout, payment activation, provisioning, provider-side mutation, upstream provider write, or hidden purchase path is in scope for TOOLS v1.

## Current launch boundary

The public launch should expose only:

- `gloryhost.cloud/tools`
- `gloryhost.cloud/tools/[slug]`
- `ops.gloryhost.cloud/v1/tools`
- `ops.gloryhost.cloud/v1/tools/:slug`
- a health or readiness endpoint such as `/health` or `/ready`

The API returns only GCH-owned catalog metadata and server-verified availability/status fields. It must not expose provider credentials, provider product IDs unless explicitly approved, raw upstream responses, Stripe state, provisioning controls, internal feature-flag names, internal order IDs, secrets, or private adapter metadata.

## Required pre-launch corrective PR

Before the TOOLS API is treated as production-ready, land the small audit corrective PR:

- Narrow Prisma `P2022` audit handling.
- Only a missing `AuditLog.orgId` column should translate to the Phase-5 migration 503.
- Unrelated missing-column/schema drift must not be reported as the Phase-5 migration state.
- Add regression coverage for both the intended `AuditLog.orgId` case and unrelated `P2022` metadata.

This is a diagnostic-safety prerequisite for production API launch.

## Authority boundaries

### Allowed in TOOLS v1

- Public product discovery.
- Read-only catalog metadata.
- Contact / Learn More / Request Access conversion paths.
- Server-owned status values such as `unknown`, `unavailable`, `contact_only`, or `request_access`.
- Documentation that honestly states that purchase/provisioning is not yet enabled.

### Not allowed in TOOLS v1

- Checkout.
- Payment activation.
- Provider-side provisioning.
- Provider-side mutation.
- Exposing upstream raw responses.
- Publishing fake SKU, availability, purchase URL, plan ID, or fulfillment status.
- Browser-side provider credentials.
- Public Stripe state or ResellPortal operational metadata.

## Feature flags

Any future purchase/provisioning path must sit behind a server-side feature flag that defaults to `OFF`.

For TOOLS v1:

- Existing dormant purchase gate remains dormant.
- No UI path should imply purchase is available when the server flag is off.
- API responses should explicitly represent contact-only or unavailable state rather than guessing.

## API review checklist

### Endpoint shape

- [ ] `GET /v1/tools` returns a bounded, schema-validated list.
- [ ] `GET /v1/tools/:slug` returns exactly one valid public record or a safe 404.
- [ ] Invalid slug returns safe not-found behavior with no internal detail.
- [ ] `/health` or `/ready` returns minimal service status.

### Schema and validation

- [ ] Request params are validated.
- [ ] Response schemas are explicit.
- [ ] Unknown provider state maps to `unknown` or `unavailable`.
- [ ] Contact-only products never publish purchase/provisioning details.
- [ ] No response includes secrets, tokens, internal provider keys, raw upstream payloads, or hidden operational IDs.

### Security controls

- [ ] CORS allowlist is explicit.
- [ ] Rate limiting is active.
- [ ] Structured logs redact sensitive data.
- [ ] Error messages are safe for public clients.
- [ ] Provider adapters are not reachable from public routes.
- [ ] Stripe remains outside public catalog routes.
- [ ] ResellPortal remains server-side authoritative and not exposed directly.
- [ ] Hostinger writes remain disabled until the real adapter contract is complete.

### UX and catalog integrity

- [ ] `/tools` renders public catalog discovery.
- [ ] At least three detail pages render cleanly.
- [ ] Every incomplete product is Learn More / Contact / Request Access.
- [ ] No fake pricing, SKU, purchase URL, fulfillment status, or provider availability.
- [ ] Copy clearly describes discovery/contact intent.

## Smoke-test matrix

Run these after deployment:

| Target | Expected result |
| --- | --- |
| `/tools` | Public catalog loads. |
| `/tools/[valid-slug]` | Tool detail page loads. |
| `/tools/[invalid-slug]` | Safe 404 or not-found response. |
| `/v1/tools` | Valid schema, bounded public list. |
| `/v1/tools/:validSlug` | Valid schema, no secrets or internal IDs. |
| `/v1/tools/:invalidSlug` | Safe 404/error payload. |
| CORS disallowed origin | Rejected. |
| Rate-limit behavior | Enforced without leaking internals. |
| Purchase CTA | Remains contact-only/request-access. |
| Logs | Structured, redacted, no secrets. |

## Required validation before launch declaration

- [ ] Tiny P2022 corrective PR merged.
- [ ] CI green.
- [ ] CodeQL green.
- [ ] Build passes for `apps/web`.
- [ ] Build passes for `apps/api`.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Dependency audit reviewed.
- [ ] Security review completed.
- [ ] Smoke-test matrix completed.
- [ ] No purchase/provisioning/provider writes are enabled.

## Deployment guidance

Deploy `apps/web` and `apps/api` independently.

Do not make portal deployment success a prerequisite for the public TOOLS catalog unless a public route actually depends on portal functionality.

Do not deploy provider writes. Do not enable purchase. Do not unblock Hostinger writes as part of this launch.

## Next release boundary

TOOLS v1.1 / Verified Purchase may begin only after every provider adapter has:

- concrete contract,
- authentication method,
- timeout policy,
- retry policy,
- schema validation,
- idempotency strategy,
- redaction policy,
- unknown-state mapping,
- audit behavior,
- and explicit security review.
