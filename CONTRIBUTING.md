# Contributing

This is the canonical GCH-ALEPH repository. Please read the
[architecture governance docs](./docs/architecture/) before making changes — the
[authority boundaries](./docs/architecture/AUTHORITY-BOUNDARIES.md) and its cardinal
rule bind every design decision here.

## Branch naming convention

Work happens on a branch, never directly on `main`. Use a `type/short-description`
name with a lowercase, hyphenated description:

```
<type>/<short-description>
```

Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.

Examples:

- `feat/gch-aleph-refactor`
- `fix/stripe-webhook-replay`
- `docs/idempotency-ttl`

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
`type(optional-scope): summary` — e.g. `docs: add architecture governance documents`,
`feat(provisioning): add deterministic idempotency key`.

## Pull request requirements

Open a PR against `main` (CI runs on PRs). A PR may be merged only when **all three**
gates pass:

- `pnpm tsc --noEmit` — type-checks with no errors. (Repo idiom: `pnpm typecheck`,
  which runs `tsc --noEmit` across the workspace via Turbo.)
- `pnpm lint` — ESLint passes with no errors.
- `pnpm test` — the test suite passes.

Run all three locally before pushing:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

`main` is (or must be) branch-protected with these as required checks.

## Architecture rule: every external call goes through a typed adapter

**Every new external call must go through a typed adapter class.** No raw `fetch` /
`axios` / direct DB connections to external systems in service files. This applies to
Stripe, ResellPortal, Hostinger, GLINKS, and any future third party.

An adapter:

- exposes typed methods for the operations GCH needs,
- is the *only* place the transport (`fetch`/SDK) for that system appears,
- carries the [deterministic idempotency key](./docs/architecture/IDEMPOTENCY.md) on
  every mutating call,
- keeps credentials server-side and never exposes them to the browser.

This keeps every authority boundary explicit, mockable in tests, and impossible to
bypass by accident. PRs that add raw external calls in service files will be sent back.

## Where things live

See the [README](./README.md#monorepo-layout) for the pnpm workspace layout.
