# Environment Strategy

GCH-ALEPH runs across four environments. Each has a distinct purpose and a distinct
**credential tier**. The governing rule is that a lower environment can never hold a
credential that could move real money or provision real infrastructure, and
**production secrets never leave production**.

## The four environments

| Environment | Purpose | Who/what uses it | Credential tier |
| --- | --- | --- | --- |
| **local** | Developer machines | Engineers running the stack locally | **Test / sandbox only** |
| **preview** | Per-branch/PR ephemeral deploys | Reviewers, automated checks | **Test / sandbox only** |
| **staging** | Production-shaped pre-release | QA, release verification | **Staging-tier** credentials |
| **production** | Live customer traffic | Real customers | **Production secrets** (never leave production) |

The promotion path is strictly `local -> preview -> staging -> production`. Code moves
up this chain; **secrets never move down it**.

## Credential tiers

### local & preview — test/sandbox only

- **Stripe:** test-mode keys (`sk_test_...`), test webhook signing secret (e.g. from
  `stripe listen`). No live key ever present.
- **ResellPortal:** sandbox credentials with `RESELLPORTAL_TEST_MODE=true`. These
  environments must be **incapable** of placing a billable wholesale order.
- **GLINKS:** a non-production `signingSecret` pointing at a non-production GLINKS
  instance.
- **Hostinger / email / DB:** local or disposable resources; SMTP left unconfigured so
  mail is logged, not sent.

### staging — staging-tier

- Staging-specific keys distinct from both sandbox and production.
- ResellPortal remains in the safe posture until the paid-order → provisioning-job
  path and its release gates are satisfied; staging is where that path is exercised
  against staging-tier suppliers, not by pointing at production.
- A staging GLINKS `signingSecret` and staging GLINKS VPS.

### production — production secrets

- Live Stripe keys, live webhook signing secret, live ResellPortal credentials, the
  production GLINKS `signingSecret`, production DB and Hostinger mailbox.
- **Production secrets never leave production.** They are not copied to laptops, CI
  logs, other environments, the browser, or the repo. Any value prefixed for the
  browser (e.g. `NEXT_PUBLIC_*`) must be, by definition, non-secret.

## Secret handling rules

- Secrets live only in each environment's own secret store / environment variables,
  seeded from `.env.example` (which contains **no real values**).
- No secret is committed to git. `.env` is git-ignored; only `.env.example` is tracked.
- Never expose Stripe / ResellPortal / Hostinger / GLINKS credentials to the browser.
  All privileged calls happen server-side through typed adapters.
- Each environment gets its **own** copy of every secret; a single secret is never
  shared across tiers, so rotating or compromising one never affects another.

## Rotating secrets without downtime

Rotation uses **overlapping validity** so there is never a window where no valid
credential exists. General procedure, per secret:

1. **Provision the new secret** in the target environment's secret store *alongside*
   the current one (do not delete the old one yet).
2. **Dual-accept where the platform allows it.** For example, Stripe supports **rolling
   the webhook signing secret** with both the old and new secret active for an overlap
   window — configure the app to verify against both during that window.
3. **Deploy** the code/config that reads the new secret (rolling deploy — instances
   pick up the new value without a hard cutover).
4. **Verify** the new secret is in use (health checks, a test event, adapter logs).
5. **Revoke the old secret** only after every instance is confirmed on the new one and
   the overlap window has elapsed.
6. **Record** the rotation (who, when, which secret) in the audit trail.

Notes per authority:

- **Stripe API keys:** create a new restricted/secret key, deploy, confirm traffic on
  the new key, then revoke the old key in the Stripe dashboard.
- **Stripe webhook secret:** use Stripe's roll-with-overlap feature; verify against
  both secrets during the overlap, then drop the old one.
- **ResellPortal API credentials:** issue new credentials, deploy, then disable the
  old ones once no calls use them.
- **GLINKS `signingSecret`:** because both sides share the secret, coordinate a brief
  overlap where the GLINKS receiver accepts tokens signed with either the old or new
  secret, deploy the new secret to GCH, then retire the old secret on both sides.

Rotation is per-environment and never causes a production secret to appear in a lower
environment.
