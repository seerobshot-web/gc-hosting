# GCH-ALEPH architecture documentation

This directory defines the target architecture for the canonical GCH-ALEPH implementation in `seerobshot-web/gc-hosting`.

The governing rule is:

> Stripe confirms the commercial transaction, ResellPortal confirms fulfillment, and GCH grants access only after both states are valid.

## Documents

| # | Document | Purpose |
| --- | --- | --- |
| 01 | [System overview](01-system-overview.md) | End-to-end platform shape |
| 02 | [Authority boundaries](02-authority-boundaries.md) | Systems of record and ownership |
| 03 | [Application architecture](03-application-architecture.md) | Modular monolith structure |
| 04 | [Domain model](04-domain-model.md) | Core entities and distinctions |
| 05 | [Checkout and provisioning flow](05-checkout-and-provisioning-flow.md) | Purchase-to-fulfillment sequence |
| 06 | [Stripe integration](06-stripe-integration.md) | Billing and webhook contract |
| 07 | [ResellPortal integration](07-resellportal-integration.md) | Fulfillment adapter contract |
| 08 | [Hostinger integration](08-hostinger-integration.md) | Infrastructure adapter contract |
| 09 | [Webhooks and idempotency](09-webhooks-and-idempotency.md) | Reliability requirements |
| 10 | [State machines](10-state-machines.md) | Payment, entitlement, provisioning states |
| 11 | [Security model](11-security-model.md) | Secrets, RBAC, credentials, audit |
| 12 | [Deployment runbook](12-deployment-runbook.md) | CI, environments, migrations, rollback |
| 13 | [Reconciliation and recovery](13-reconciliation-and-recovery.md) | Drift detection and manual repair |
| 14 | [Observability](14-observability.md) | Logs, metrics, traces, correlation IDs |
| 15 | [Support and incident runbook](15-support-and-incident-runbook.md) | Operational handling |

## Implementation status

This is the target contract. Existing code still contains earlier `Plan`, `Subscription`, `Invoice`, `WebhookEvent`, and `ProvisioningOrder` models. Future implementation work should migrate toward this architecture without activating live supplier ordering until the order, entitlement, provisioning-job, and reconciliation release gates are satisfied.
