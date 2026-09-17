# Repository consolidation guardrails

Date: 2026-09-17

## Decision

`seerobshot-web/gc-hosting` is the canonical GCH-ALEPH repository. `seerobshot-web/gch_alep2` is frozen as a legacy preservation repository.

## Rationale

Two unrelated repositories were being changed in parallel. The review found no shared file identity between the repositories and materially different architecture assumptions:

| Repository | Role after this decision |
| --- | --- |
| `gc-hosting` | Canonical ALEPH application and Hostinger-compatible deployment target |
| `gch_alep2` | Legacy source for bounded GLINKS inventory/extraction and historical audit |

## Allowed work

| Repository | Allowed changes |
| --- | --- |
| `gc-hosting` | Core ALEPH architecture, marketing site, product registry, Stripe billing, GCH orders, provider mappings, provisioning jobs, customer portal, Hostinger compatibility |
| `gch_alep2` | Security fixes, freeze docs, GLINKS inventory, GLINKS extraction, archival notes |

## Blocked work

1. No new core features in `gch_alep2`.
2. No push-triggered GCP deployment from `gch_alep2`.
3. No live ResellPortal ordering from `gc-hosting` until durable paid-order provisioning exists.
4. No reintroduction of FOSSBilling as the ALEPH billing brain without a new ADR.
5. No provider-specific customer onboarding that bypasses GCH-owned entitlement and service records.

## Release gates

Before production launch:

1. Protect `main` on both repositories.
2. Require CI for merges into canonical `main`.
3. Build Stripe -> GCH Order -> provisioning job -> provider adapter -> entitlement/service -> onboarding as the only provisioning chain.
4. Record a GLINKS ADR choosing separate service versus port.
5. Verify Hostinger infrastructure compatibility against current Hostinger API and Node.js hosting documentation.
