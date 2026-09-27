# PR #59: Phase 3 evidence gates and security review

## Repository evidence and status

| Contract area | Verified fact | Assumption | Blocker/evidence required | Enabled? |
| --- | --- | --- | --- | --- |
| Product mappings | 18 catalog slugs; all API mappings pending with null external identifiers | None | Approved initial SKU and mapping evidence | No |
| Destinations | Approved order destination null in every mapping | None | Approved destination and allowlist | No |
| Stripe payment eligibility | Server checks webhook signatures; local checkout completion updates PAID | Local PAID might reflect checkout completion | Approved eligible states/events, refunds/disputes and signed sandbox fixtures | No |
| ResellPortal catalog | Editorial catalog is local; adapter lacks verified catalog contract | None | Official read schema, availability and pagination | No |
| ResellPortal fulfillment | Fixture responses are synthetic | None | Official normalized status/verification schema | No |
| Idempotency | Internal keys are deterministic | Provider might honor a key header | Provider guarantee and remote reconciliation contract | No |
| Retry/failure states | Recovery scans local paid rows for operator review | None | Provider timeout, ambiguous result, retry and terminal rules | No |
| Entitlement policy | Pure assessment has no grant side effect | None | Approved granting, revocation, cancellation and audit rules | No |

`phase3-evidence.registry.ts` derives per-product status from the existing ResellPortal mapping registry and records other contract gaps with stable reason codes. It is not a second SKU list. `phase3-purchase-gate.ts` consumes separate product, destination, payment, fulfillment, policy, tenant/order and contract observations; normalized safety categories are internal classifications, not invented upstream status values. Its compile-time rollout switch is false, and the pure preflight never authorizes purchase even with synthetic positive fixture data. No provider, payment or entitlement adapter consumes it.

The read-only route keeps PR #58's membership and scoped lookup. It adds `status: "blocked"`; existing `reason`, local status and correlation key remain for compatibility. A locally ACTIVE order is still not payment or fulfillment proof. No database migration is needed. Rollback is reverting this PR; existing pending mappings and disabled purchase paths remain in place.

## Security review of inspected surfaces

| Severity | File | Exploit precondition and finding | Recommended fix / coverage |
| --- | --- | --- | --- |
| High | `apps/api/src/audit/audit.controller.ts` | Any authenticated account can request `GET /audit`; no org permission is declared and the response may contain other tenants' records. | Add scoped audit storage/query and org membership guard before exposing this endpoint. This PR's readiness lookup test does not cover audit. |
| Medium | `apps/api/src/auth/jwt.strategy.ts` | Possession of a valid token signed with the access secret is checked for expiration but issuer and audience are not configured. | Define issuer/audience when an approved token policy exists, verify refresh/replay paths with integration tests. No JWT policy changed here. |
| Medium | `apps/api/src/billing/stripe-webhook.service.ts` | A signature-verified checkout completion can produce local PAID without approved payment-state eligibility; relying on PAID for fulfillment would be unsafe. | Keep Phase 3 purchase blocked; approve eligibility and signed sandbox fixtures before consuming webhook state. |
| Medium | `apps/api/src/provisioning/resellportal.client.ts` | Existing lifecycle methods have locally assumed schemas and remote retry/idempotency guarantees are unverified; an ambiguous provider timeout could duplicate work if called. | Obtain official contracts, reconcile ambiguous outcomes and test timeout-after-success before enabling mutations. |
| Low | `apps/api/src/provisioning/order-readiness.service.ts`, `order-readiness.controller.ts` | An authenticated tenant member with `provisioning:read` can see local order status; scoped lookup excludes cross-tenant orders. | Continue tests for guard metadata, scoped query, identical 404 and safe fields; add end-to-end JWT/malformed-ID tests before rollout. |

Reviewed `apps/api/src/main.ts`: CORS uses an explicit allowlist with credentials, no wildcard. The changed gate and registry contain no network calls, URLs, secrets, raw provider responses, redirects, HTML, or logging. Reviewed `apps/web/src/content/tools/toolCatalog.ts` and `apps/web/src/components/marketing/GCHToolDetailPage.astro`: catalog content remains contact-only without approved storefront links. Source maps, built Astro HTML, Next.js client bundles, analytics, SSRF/XSS/CSRF behaviors, and full JWT refresh/replay behavior were not independently inspected or dynamically tested in this change; no claim is made about them. `apps/api/package.json` and `apps/portal/package.json` were inspected; no dependency or lockfile change was made. No pinned `@hostinger/sdk` 1.54.1 generated-method source was supplied or used.

## Verification and enablement

The negative tests cover all 18 entries, external contract gaps, all normalized payment and fulfillment denial categories, tenant/order mismatch, absent evidence, policy and feature switch denial, deterministic concurrent pure assessments, and no provider or entitlement invocation. Fixture IDs and synthetic observations have no external authority. Duplicate remote operations remain untested pending an official provider idempotency fixture.

Deploy only after approved external contracts, a reviewed entitlement policy, scoped audit remediation, complete integration/security tests, and a sandbox transaction. Until then, keep the flag disabled and do not deploy this PR.
