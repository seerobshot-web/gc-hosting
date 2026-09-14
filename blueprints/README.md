# Blueprints

Not code — Client Delivery Blueprints: the SOPs, checklists, and boilerplate
assets a GCH operator (human or, eventually, the GCH Aleph agent) follows
when delivering a client site. Kept separate from `apps/`/`packages/` so
this can stay pure documentation without pulling in TypeScript tooling.

## What belongs where

- **`website-builder/`** — Hostinger AI Builder SOPs and checklists. Use
  this when a client's deliverable is built with Hostinger's own builder
  rather than custom code or WordPress.
- **`wordpress/`** — approved theme boilerplate, the plugin lockfile, and
  security rules. Use this when a client's deliverable is a WordPress site.
- **`custom-code/`** — static/SSR launch templates, webhook examples, and
  embed snippets. Use this when a client's deliverable is a bespoke
  Next.js/Astro build (i.e. this monorepo's own stack) or a third-party
  embed that needs to talk to `apps/api`.

Add new SOPs under the subfolder that matches the delivery method, not by
client name or date — this directory is a method library, not a project
archive. If a new delivery method emerges that doesn't fit these three,
that's a real conversation (a new subfolder, not a dumping ground inside an
existing one).
