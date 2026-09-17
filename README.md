# gc-hosting-platform

## Canonical GCH-ALEPH repository

This repository is the canonical destination for GCH-ALEPH core work as of 2026-09-17.

Core application, billing, product registry, provider mapping, provisioning, Hostinger compatibility, and marketing/customer portal work should target this repository. Do not open new feature PRs against `seerobshot-web/gch_alep2` except for bounded GLINKS preservation or security-freeze work.

## Consolidation status

| Area | Status |
| --- | --- |
| Canonical repo | `seerobshot-web/gc-hosting` |
| Legacy repo | `seerobshot-web/gch_alep2` |
| New core feature work | This repository only |
| GLINKS source of truth | Legacy inventory until ADR approval |
| Live ResellPortal ordering | Disabled until the durable GCH Order -> provisioning job path is approved |
| Infrastructure target | Hostinger-compatible deployment path; GCP automation must not be reintroduced without ADR approval |

## Release gates

Before production release:

1. `main` must be branch-protected with required CI checks.
2. Production must not be able to submit ResellPortal orders with `test_mode:false` until a paid GCH order, provider mapping, idempotent provisioning job, and reconciliation path exist.
3. Stripe payment events must create GCH orders, not direct provider calls.
4. Provider credentials, supplier IDs, and customer onboarding must remain behind GCH-owned abstractions.
5. Hostinger compatibility must be checked against current Hostinger API and Node.js hosting guidance before deployment.
