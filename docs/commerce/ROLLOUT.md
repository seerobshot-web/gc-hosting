# Prepaid commerce rollout

## Current boundary

This change is test-only. The Stripe adapter rejects live keys and live events. All nine RP deals remain disabled in source, even when allowlisted in the environment. Brand Identity Development can be enabled only in a test deployment after policies, private PDF storage, SMTP and origins are configured. It uses human fulfillment, never an RP order. This is not production launch approval and does not waive any gate in the supplied brief.

The owner confirmed the first yearly retail table. Prices and package contents are shared by API, portal and marketing through `@gch/commerce`; aggregate yearly wholesale budgets are marked unverified. These yearly budgets are not initial wallet charges: monthly-only items must be funded on their actual billing cycles. No provider IDs, costs, payload fields or wallet endpoint were guessed.

## Required test configuration

See the value-free root `.env.example`. The existing boot-time API variables still apply. Configure `STRIPE_SECRET_KEY` with a test key and `COMMERCE_STRIPE_WEBHOOK_SECRET` for a separate endpoint at `/commerce/webhook`. Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded`
- `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`

Set `COMMERCE_ENABLED=true`, explicitly allow `brand-identity-development` in `COMMERCE_ENABLED_DEALS`, and approve policies with `COMMERCE_POLICIES_APPROVED=true` only once the tax/refund/receipt and legal decisions are settled. Confirmed policy text must replace the pending-approval web pages before this flag is enabled. Use synthetic accounts and test mailboxes only. `COMMERCE_TAX_MODE` must reflect an explicit decision: this test rollout supports only `none`. Missing/other values block checkout; taxable sales require a separately implemented and verified Stripe Tax path. No sales-tax decision was made for the owner.

Configure `COMMERCE_PORTAL_ORIGIN`, `COMMERCE_API_ORIGIN`, a comma-separated `COMMERCE_OPS_USER_IDS` allowlist, and a test `COMMERCE_OPS_EMAIL`. Origins must be trusted deployment URLs. `ALLOWED_ORIGINS` remains an explicit CORS allowlist. Checkout and the webhook retain the app's global rate limit; checkout tightens it to ten requests per minute.

Use an independent random `COMMERCE_DELIVERY_SECRET` with at least 32 characters. Configure a separate 32-byte key encoded as 64 hex characters in `COMMERCE_INTAKE_KEY`. Do not rotate the intake key without a reviewed decrypt/re-encrypt migration and backups; losing it loses access to stored intake files. Intake is AES-256-GCM encrypted in MySQL, bound to order/user identity, and limited to 512 KB PDF/PNG. Operations downloads are authenticated and non-cacheable.

Copy all ten original PDFs into an absolute private directory and set `COMMERCE_GUIDE_DIRECTORY`. The uploaded originals are currently preserved locally in ignored `private/commerce-guides/`; deploy them through a private asset/secret channel, never Git or an app public directory. No guide link or mail body is logged by the required-delivery mail method.

Configure test SMTP credentials. Missing SMTP never counts as successful delivery. Delivery links expire in one hour, bind order/deal identity, and refuse held or failed orders. They deliver public onboarding instructions, not provider credentials. The initial human-service guide is sent after verified payment so the customer can complete intake; a welcome message follows explicit human fulfillment confirmation. SMTP is at-least-once: a crash after send but before the DB update can repeat an email. This is documented and does not repeat payment or fulfillment.

## Build and staging migration

From the repository root, using the pinned pnpm version and Node 22 or newer:

```sh
pnpm install --frozen-lockfile
pnpm --filter @gch/database run generate
pnpm --filter @gch/commerce run build
pnpm --filter @gch/database run build
pnpm --filter @gch/permissions run build
pnpm --filter @gch/database exec prisma migrate deploy
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

The additive commerce migration must be applied to a disposable staging MySQL database before deploying the API. No production migration was run. Restrict the runtime DB user to necessary application operations; use a separate migration identity. Save a database backup and the previous app deployment identifiers before any later approved production release.

Hostinger portal builds already build database and permissions dependencies; this change adds the commerce dependency to its standalone build chain. Marketing's standalone build now builds commerce too. The API's standalone build likewise builds its dist-based dependencies. `apps/web` outputs static files to `apps/web/dist`; `apps/portal` uses `next start`; `apps/api` uses `node dist/main.js` from its app directory. Existing Hostinger hosting specifics must be verified against the deployment's actual package-root and monorepo support before changing deployment settings.

Use the existing API health endpoint `GET /health`, plus the read-only `GET /commerce/catalog` to inspect availability after deploying. Check marketing `/deals`, `/tools`, `/contact`, `/terms`, `/privacy`, `/refunds`, and authenticated portal `/dashboard/orders`. Canonical production marketing/API origins remain unconfirmed; no domain change was made.

## Test purchase and review

1. Create a synthetic portal account, sign in, then use `/dashboard/orders` to create a hosted Stripe test Checkout Session. The order ID is `client_reference_id`; metadata includes `order_id`, `deal_id`, `catalog_version`. Prices never come from the request.
2. Replay the exact signed paid event concurrently and sequentially. `CommerceStripeEvent` is a permanent unique ledger; the claim, transition, audit and durable job share a transaction. No duplicate fulfillment is emitted through an in-process event bus.
3. For ACH, deliver an unpaid completed session first: no paid transition or fulfillment. Then deliver async success with `payment_status=paid`. Async failure never grants access.
4. The five-minute job re-reads Stripe (including current charge refund/dispute state), rechecks flags/version, then holds or marks the human order provisioning. Held orders alert ops; no automatic refund occurs. No RP-dependent offer is available.
5. Complete the human work outside the application. A JWT user in `COMMERCE_OPS_USER_IDS` may explicitly confirm via `POST /commerce/ops/orders/:id/confirm-human-delivery`. The API re-verifies payment and transitions provisioning → provisioned → active with audits. This endpoint refuses RP deals.
6. Verify private guide delivery, expired/tampered links, encrypted intake upload, cross-user list/intake isolation and operations permissions. Refund/dispute events hold an order and prevent further guide retrieval or delivery. The worker never automatically releases a held order.
7. Disable `COMMERCE_ENABLED`; checkout must reject without contacting Stripe. Already-paid orders are held on preflight; delivery and completion also stop. Refunds/disputes continue being accepted for review.

No automated RP paid-to-active test can be run until the provider reference, mappings, item costs/cycles, wallet contract and staging credentials are supplied. Those are implementation prerequisites, not environment switches.

The portal emits a local `gch:conversion` custom event on checkout intent with only event name, deal ID and catalog version. It contains no email, user/order ID, intake or credential data; an analytics collector has not been configured.

## Rollback

Disable `COMMERCE_ENABLED` first and remove enabled deal IDs. Restore the previous Hostinger build/deployment for each app (marketing static artifact, portal Node build, API Node build); verify API health and existing subscription/Tools behavior. Leave the additive commerce tables and their permanent event/job records intact so a rollback cannot erase payment history. Do not run destructive down migrations. Preserve the private PDFs and intake encryption key separately from app builds. No Hostinger rollback was exercised in this workspace.
