# Custom Code Blueprint

Static/SSR launch templates, webhook examples, and embed snippets for
bespoke builds — i.e. anything using this monorepo's own Next.js/Astro
stack, or a third-party embed that talks to `apps/api`.

## Checklist
- [ ] Scaffold from `apps/web` (marketing/static) or `apps/portal`
      (authenticated/dashboard) depending on the deliverable
- [ ] Any embed or webhook consumer should target `apps/api`'s
      OpenAPI-documented endpoints (`/docs`) — REST/OpenAPI was chosen over
      tRPC specifically so third-party, non-TS consumers aren't locked out
- [ ] Provision hosting via the standard ResellPortal order flow
- [ ] Apply `packages/ui`'s Tailwind preset rather than hand-rolled tokens

## Open items
Launch templates and webhook examples themselves aren't authored yet —
this is the checklist shell to fill in as real client deliverables happen.
