# Phase 3 fulfillment execution review

Status: **blocked for live fulfillment**. This document records repository evidence and implementation gates; it does not approve a product mapping, payment state, provider API, or deployment.

## Repository evidence

- The canonical repository is `seerobshot-web/gc-hosting`. `apps/api` contains Stripe billing, the order state machine, and a ResellPortal client; `workers/cron-jobs` contains a legacy provisioning-order poller.
- `apps/api/src/provisioning/resellportal/resellportal-mapping.registry.ts` marks all listed products `pending-verification`, with `purchaseEnabled: false`, null external identifiers and no approved order destination.
- `apps/api/src/billing/billing.service.ts` rejects product checkout even after the mapping check. The separate subscription-plan checkout remains implemented; its semantics must not be mistaken for an approved product purchase.
- `apps/api/src/provisioning/resellportal.client.ts` explicitly describes the `web_hosting` order body/response as unverified. Its Phase 5 `POST /services` lifecycle methods and `{ service_id, status }` response schema also require independent contract evidence before execution against a provider. A deterministic `Idempotency-Key` header is only sufficient if the provider confirms that it honors the header for each operation.
- `apps/api/src/billing/stripe-webhook.service.ts` moves an order to PAID on `checkout.session.completed` without checking `session.payment_status` or independently verifying the qualifying payment state. The accepted states need product approval and Stripe test fixtures.
- The webhook persists an idempotency record and then emits `order.paid` through the in-process event emitter. A crash in that interval causes replay to return the cached result without re-emitting, leaving a paid order unprocessed. The order update, audit, and idempotency write are also separate database operations.
- `apps/api/src/provisioning/provisioning.service.ts` creates a placeholder ProviderService and transitions PAID to PROVISIONING before the provider call. If the process dies after the placeholder write, later calls find a PROVISIONING row but cannot safely start the transition again. On a provider timeout or a failure after a successful provider response, the catch path can mark the local service TERMINATED and order FAILED without verifying whether the remote service exists.
- The standalone `workers/cron-jobs/src/resellportal-poller.ts` sweeps legacy `ProvisioningOrder` rows, not the new `Order` / `ProviderService` path. It cannot recover a stranded PAID order. Its request uses only `X-API-Key` while the current client also requires `X-API-Secret`; reconcile against the documented API before relying on it.
- `apps/api/src/billing/stripe-webhook.service.spec.ts` covers valid/invalid signatures and sequential replay but does not simulate a crash after persistence, concurrent deliveries, unpaid checkout completion, or an ambiguous provider timeout.

## Safe implementation order

1. Obtain the approved first SKU, Stripe payment eligibility rule, actual ResellPortal sandbox or test-mode request/response fixtures, idempotency guarantees, and service-state definitions. Keep all product purchases disabled until verified.
2. Persist the Stripe event handling result, order transition, and an outbox work item in one database transaction. A scheduled worker must claim durable items and recover stranded PAID orders. Do not use the in-process emitter as the only handoff.
3. Before a provider mutation, claim work with a database lease and stable operation key. On timeout or ambiguous response, reconcile by provider order key or service ID; do not label the service terminated or send a second create request until the remote outcome is known.
4. Grant entitlement only after an approved Stripe payment state and verified provider fulfillment are both present. Expose tenant-scoped status and operator reconciliation with redacted audit records.
5. Test concurrent duplicate webhooks, crash points, process restart, provider timeout after success, cancellation/refund races, tenant isolation, and recovery. Run typecheck, lint, tests, and a test-mode end-to-end order before changing the purchase flag.

## Release decision

No live order, provider lifecycle mutation, entitlement grant, Hostinger deployment, or production webhook configuration is authorized by this review. Existing code and tests are a scaffold; Phase 3 completion requires observed test-mode evidence for both upstream authorities and recovery behavior.
