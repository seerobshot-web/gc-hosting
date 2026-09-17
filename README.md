# gc-hosting-platform

GCH-ALEPH is an **orchestration** platform: Stripe owns the commercial transaction,
ResellPortal owns fulfillment, and GCH grants access only after both are valid. See the
[architecture documentation](#architecture-documentation) for the governing rules.

## Monorepo layout

This is a [pnpm workspaces](https://pnpm.io/workspaces) + [Turborepo](https://turbo.build/)
monorepo (see `pnpm-workspace.yaml`). Workspaces live under `apps/*`, `packages/*`, and
`workers/*`:

| Path | Package | Description |
| --- | --- | --- |
| `apps/api` | `@gch/api` | NestJS (Fastify) backend — orgs, clients, auth, billing/Stripe webhooks, provisioning, audit. The orchestration surface. |
| `apps/portal` | `@gch/portal` | Next.js 14 (App Router) customer/operator portal. |
| `apps/web` | `@gch/web` | Astro marketing / dashboard-preview site. |
| `packages/database` | `@gch/database` | Prisma schema + generated client (MySQL). The `db` package. |
| `packages/permissions` | `@gch/permissions` | Shared RBAC permission map and types. |
| `packages/motion` | `@gch/motion` | Shared UI motion primitives. |
| `packages/ui` | `@gch/ui` | Shared UI components / Tailwind preset. |
| `workers/cron-jobs` | — | Background workers (ResellPortal poller, SSL expiry, audit integrity). |

> **Layout note.** Earlier architecture drafts referred to `packages/db` and
> `packages/shared`. In this repo those are realized as `packages/database` (the Prisma
> package) and the focused shared packages `packages/permissions` / `packages/motion` /
> `packages/ui`. Paths in older docs should be read against this actual layout.

### Common commands

```bash
pnpm install            # install all workspaces
pnpm --filter @gch/database run generate   # generate the Prisma client
pnpm build              # build every workspace (turbo)
pnpm typecheck          # tsc --noEmit across workspaces
pnpm lint               # eslint across workspaces
pnpm test               # run workspace test suites
```

The CI gate for every PR is `pnpm typecheck && pnpm lint && pnpm test`
(see [CONTRIBUTING.md](./CONTRIBUTING.md)).

## Architecture documentation

The governance and architecture docs live in [`docs/architecture/`](./docs/architecture/):

| Document | Purpose |
| --- | --- |
| [AUTHORITY-BOUNDARIES.md](./docs/architecture/AUTHORITY-BOUNDARIES.md) | The three-authority model (Stripe / ResellPortal / GCH), the cardinal rule, and the order-lifecycle state machine. |
| [GLINKS-INTEGRATION.md](./docs/architecture/GLINKS-INTEGRATION.md) | Isolation of the legacy GLINKS VPS and its HMAC-signed, versioned internal API. |
| [ENVIRONMENT-STRATEGY.md](./docs/architecture/ENVIRONMENT-STRATEGY.md) | The four environments, credential tiers, and zero-downtime secret rotation. |
| [IDEMPOTENCY.md](./docs/architecture/IDEMPOTENCY.md) | Deterministic idempotency keys and the `IdempotencyRecord` TTL policy. |
| [RESELLERSPANEL-ERROR-CODES.md](./docs/architecture/RESELLERSPANEL-ERROR-CODES.md) | RSP numeric error-code reference (debugging context only). |

See also [CONTRIBUTING.md](./CONTRIBUTING.md) for branch/PR conventions and the
typed-adapter rule.

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
