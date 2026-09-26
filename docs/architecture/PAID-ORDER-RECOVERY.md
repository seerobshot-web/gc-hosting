# Paid-order recovery foundation

This slice is deliberately fail-closed. It creates **operator review records**, not provider work or entitlements. Product mappings, eligible Stripe payment states and the ResellPortal mutation/idempotency contract remain unverified.

## Current model and recovery states

| State | Evidence and owner | Current handling |
| --- | --- | --- |
| Payment event received | Signed Stripe webhook | Signature verified in `StripeWebhookService` |
| Payment observed / local `PAID` | `Order` and `IdempotencyRecord` | Existing webhook stores a payment reference, then emits an in-process event; eligible payment states remain unapproved |
| Fulfillment pending | No `ProviderService` | New scheduled query detects aged `PAID` orders with a payment reference and no provider row |
| Review required | Unique `IdempotencyRecord` + `AuditLog` | Atomic transaction records a stable key and org-scoped audit reference; repeated/concurrent scans do not create another review |
| Fulfillment in progress | Existing `PROVISIONING` / placeholder provider row | **No automated recovery**: remote outcome could be ambiguous |
| Fulfillment verified | Approved provider evidence | **Blocked** pending real provider contract and state mapping |
| Entitlement pending / granted | Both approved payment and fulfillment predicates | **Blocked**; this slice never grants access |
| Retryable failure | Failed review transaction | Transaction rolls back; next minute's sweep can retry |
| Terminal failure | Operator review marker | Review is visible in the existing audit history; no irreversible local or remote status is asserted |

The query is capped at 100 candidates per sweep and waits five minutes after the last order update. The marker key is a stable SHA-256 of the order identity and review operation; audit metadata contains the organization ID and reason but no payment identifier, provider credential or payload. A candidate advancing to a provider service between query and transaction is ignored. A unique-key collision collapses concurrent claims. If the audit insert fails, the marker and audit insert roll back together.

**Crash boundary:** a process crash after the webhook's idempotency write but before `order.paid` emission leaves a `PAID` order with no provider service. The scheduled scan makes that order visible to operators. It does not replay the unsafe listener, because the provider creation path has no verified remote idempotency or reconciliation contract.

## Remaining contract and implementation gaps

- Approve the exact Stripe payment eligibility rule and store its verified evidence transactionally with a durable outbox event. Current local `PAID` alone is insufficient proof.
- Approve one product mapping and the ResellPortal create/status/idempotency/retry contracts before a worker submits or repeats a provider operation.
- Add a durable, leased work queue for provider operations and separate verified fulfillment/entitlement predicates. Handle ambiguous timeouts through remote reconciliation before another create.
- Extend reconciliation to orphaned `PROVISIONING` rows; the existing legacy `ProvisioningOrder` cron does not cover these.
- Product checkout remains disabled. No new public API or client route is introduced.

The service is registered in the NestJS provisioning module and runs under its existing scheduler. It makes no Stripe, ResellPortal, Hostinger or entitlement calls.
