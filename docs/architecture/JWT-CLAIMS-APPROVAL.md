# JWT access-token claim policy — approval request

**Status: BLOCKED for runtime issuer/audience changes.** This follow-up is independent of the audit tenant-key migration. It records a testable contract request; it does not add claim values, change token issuance or validation, alter refresh behavior, or deploy.

## Inspected evidence (default branch)

- `apps/api/src/auth/auth.service.ts`: `issueTokens` signs `{ sub: userId, email }` with `expiresIn: 15 * 60` using the registered JwtService. `refresh` hashes an opaque refresh token, reads the stored row, checks revocation/expiry, updates `revokedAt`, then issues a new pair.
- `apps/api/src/auth/auth.module.ts`: JwtModule receives `JWT_ACCESS_SECRET`; no issuer/audience registration.
- `apps/api/src/auth/jwt.strategy.ts`: bearer extraction, secret verification and `ignoreExpiration: false`; no issuer/audience constraints. Its validate method maps `sub` and `email`.
- `apps/api/src/config/env.schema.ts` and `.env.example`: declare access signing secret, not claim-policy values. No approved claim values were found in these inspected files.
- `apps/api/src/auth/auth.controller.ts`: refresh and logout are public routes; login/register have endpoint throttles, refresh/logout do not declare endpoint-specific throttles. Global throttling, if any, requires separate inspection before claiming they are unbounded.
- `apps/portal/src/lib/auth.ts`: NextAuth stores API token pair, decodes an API access-token payload for `sub` and `email`, and refreshes through `/auth/refresh`. It has its own session mechanism and secret. Its decode is not proof that the API access token is verified there.
- `apps/api/src/config/env.schema.spec.ts` tests boot validation but not JWT claim mismatch. The expected paths `apps/api/src/auth/auth.service.spec.ts` and `apps/api/src/auth/jwt.strategy.spec.ts` were absent when queried.
- `apps/api/package.json` defines `pnpm --filter @gch/api test` and the repository CI tests. No runtime change is made here.

## Decision request

| Decision | Required owner | Evidence and test gate | State |
| --- | --- | --- | --- |
| Access-token issuer value and trust boundary | Auth/security owner (person unassigned) | Canonical token-issuing service and approved issuer per environment; ensure migration from previously issued tokens is planned | BLOCKED |
| Access-token audience value and intended recipients | API auth owner (person unassigned) | Approved set of API recipients, whether other internal services consume these JWTs, and environment policy | BLOCKED |
| Configuration and rollout | API operations owner (person unassigned) | Non-secret claim configuration source, token transition window, boot validation, rollback and key-sharing inventory without printing secrets | BLOCKED |
| Refresh reuse and replay policy | Auth/security owner (person unassigned) | Concurrent-refresh semantics, revocation behavior, portal session behavior, failure telemetry and negative tests | Separate follow-up |

The observed absence of an issuer/audience **could** allow a signed token from another context to be accepted when that context shares `JWT_ACCESS_SECRET`; whether such a context exists has not been established. Treat this as a potential cross-context token risk, not proof of an exploit or of secret reuse.

## Future approved change and tests

Once values and token transition are approved, configure issuance and strategy verification as one coordinated change. Require mismatched or missing issuer/audience to fail; test a valid signed token, wrong and absent issuer, wrong and absent audience, expired token, invalid signature, and transition-window behavior. Confirm the portal still signs in and refreshes. Separately test that two concurrent refresh attempts cannot both rotate one token, and review endpoint throttling and replay requirements.

Keep error bodies and logs free of JWTs, refresh tokens, email addresses and shared secrets. Tests should use generated fixture-only secrets and identity data; never use production credentials. Do not infer the issuer from website origins or the audience from a URL, hostname, portal session, or request body.

## Audit migration independence and rollback

This document has no runtime effect. Reverting it removes only the decision request. Preserve the existing audit `GET /audit` 400/404/503 and zero-row-read boundary. No issuer/audience enforcement is approved by this document. No provider, payment, migration, database, deployment, or entitlement operation occurs.
