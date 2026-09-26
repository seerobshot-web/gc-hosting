# Phase 3 contract evidence and mock-only boundaries

This increment defines **internal observations and a pure readiness decision**. It is not a Stripe or ResellPortal adapter, does not start fulfillment, and does not grant access. No production module imports the new function. All positive evidence in tests is explicitly synthetic.

## Evidence review

| Concern | Repository evidence | Approved external contract |
| --- | --- | --- |
| Product | `resellportal-mapping.registry.ts`: all current slugs are pending, purchase disabled, external IDs and destinations null. `resellportal-mapping.service.ts` fails closed. | No initial SKU or billing-cycle mapping approved. `resellportal-contract.fixtures.ts` contains illustrative values only. |
| Payment | `stripe-webhook.service.ts` verifies webhook signatures and handles `checkout.session.completed`; its local `PAID` transition does not establish an approved `payment_status` predicate. | Eligible payment states, delayed-payment, refunds, disputes and cancellation policy unresolved. |
| Provider | `resellportal.client.ts` sends assumed lifecycle requests with an `Idempotency-Key` header and parses a local schema. Its own comment flags the legacy order body and response as unverified. `resellportal.client.spec.ts` intercepts fetch with synthetic responses. | Endpoint, authorization, request/response fields, remote idempotency behavior, retries, timeouts, error/status normalization and polling are not approved. |
| Recovery | `paid-order-recovery.service.ts` records aged local PAID orders for operator review without provider calls; `PAID-ORDER-RECOVERY.md` documents this boundary. | Safe automatic provider retry and verified entitlement are unresolved. |

The code therefore uses only GCH-owned `orderId`, `orgId`, evidence references, and boolean observations from distinct authorities. `unconfiguredObservations` denies all three predicates. `assessEntitlementReadiness` requires matching order/tenant, approved product, independently verified payment and fulfillment, and nonempty evidence references. Its `ready: true` output is an **assessment from fixture inputs**, never an entitlement write or permission grant. The stable correlation key is internal and makes no assertion that a provider honors an idempotency header.

## Verification limits and pending tests

- Positive fixture tests prove separation of predicates, not that the fixture observations are authoritative. There is no verified source adapter to create true payment or fulfillment observations in production.
- Existing PR #56 covers concurrent recovery review claims. The new pure function is deterministic under concurrent calls but is not a worker claim and cannot establish provider-side idempotency.
- Provider retryable/terminal failures, duplicate remote operation prevention, payment-state eligibility and operator reconciliation of provider failures need approved contracts. Tests for those behaviors remain pending; do not simulate invented status codes or retry semantics.
- Existing live-capable ResellPortal methods remain untouched and must not be wired to this module based on these fixtures.
