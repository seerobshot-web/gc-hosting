# GLINKS Integration

> **Terminology note.** "GLINKS" here refers to the **separate legacy GLINKS system**
> (a standalone CodeIgniter + PostgreSQL application on its own Hostinger VPS), which
> GCH integrates with over an HMAC-signed internal API. This is **not** the same thing
> as the `GLink` / `GLinkModuleType` Prisma model in `packages/database` (the
> "GloryLink" per-client module links stored in GCH's own MySQL database). They share a
> name but are unrelated concerns. This document is exclusively about the external
> legacy GLINKS system and its isolation contract.

## Isolation principle

GLINKS is a legacy system with its own runtime, framework, and datastore. GCH treats
it as a **black box reached only through a versioned, HMAC-signed internal REST API**.
GCH never reaches into GLINKS's database, never runs migrations against it, and never
embeds GLINKS business logic. GCH only **proxies** requests to it through a typed
adapter.

| Aspect | GLINKS | GCH |
| --- | --- | --- |
| Host | Separate Hostinger VPS | GCH's own deployment |
| Framework | CodeIgniter (PHP) | NestJS (TypeScript) |
| Database | PostgreSQL (its own) | MySQL (Prisma) |
| Ownership of GLINKS data | GLINKS | never GCH |

### Hard rules

1. **Separate VPS.** GLINKS runs on its own Hostinger VPS, isolated from GCH.
2. **No shared database.** GLINKS keeps its CodeIgniter/PostgreSQL datastore. GCH's
   Prisma schema does **not** model GLINKS tables.
3. **NO DB migration.** GCH must never migrate, alter, or seed the GLINKS database.
   The GLINKS schema is the source of truth for GLINKS data, full stop.
4. **GCH only proxies.** Every GLINKS interaction goes out through a typed adapter
   class as an HTTP call to the GLINKS internal API — no raw `fetch`/`axios` in
   service files, no direct DB connection.
5. **Versioned endpoints.** All calls target versioned paths (`/api/v1/...`) so GLINKS
   can evolve without breaking GCH.

## HMAC-signed internal API

Every internal request from GCH to GLINKS is signed so GLINKS can verify it originated
from GCH and was not tampered with or replayed.

Two headers accompany every request:

| Header | Value |
| --- | --- |
| `X-Timestamp` | The request timestamp (used in the signature and for replay-window checks) |
| `X-Internal-Token` | `sha256(timestamp + ':' + body, signingSecret)` |

The token is computed as:

```
X-Internal-Token = sha256( timestamp + ":" + body , signingSecret )
```

where:

- `timestamp` is the exact value sent in the `X-Timestamp` header,
- `body` is the exact raw request body bytes (empty string for bodyless requests),
- `signingSecret` is the shared internal secret, never exposed to the browser and
  never committed (see [ENVIRONMENT-STRATEGY.md](./ENVIRONMENT-STRATEGY.md)).

The receiving side (GLINKS) recomputes the token over the same `timestamp` and raw
body with its copy of `signingSecret` and rejects the request on mismatch. The
`X-Timestamp` value should also be range-checked to reject stale/replayed requests.

### Reference signing (illustrative)

```ts
import { createHmac } from "node:crypto";

function signInternalRequest(timestamp: string, body: string, signingSecret: string) {
  const token = createHmac("sha256", signingSecret)
    .update(`${timestamp}:${body}`)
    .digest("hex");
  return { "X-Timestamp": timestamp, "X-Internal-Token": token };
}
```

> The signature covers `timestamp + ":" + body`, binding the request to a point in time
> and to its exact payload. Any change to either invalidates the token.

## Versioning

- All GLINKS endpoints are called under a version prefix: `/api/v1/...`.
- A breaking change on the GLINKS side introduces `/api/v2/...`; GCH migrates its
  adapter deliberately rather than silently following a mutated `v1`.
- The adapter pins the version it speaks, so the contract is explicit in one place.

## What GCH must never do

- Open a direct PostgreSQL connection to GLINKS.
- Run any migration, DDL, or seed against the GLINKS database.
- Duplicate GLINKS-owned records as authority inside GCH.
- Call GLINKS endpoints without the `X-Timestamp` / `X-Internal-Token` headers.
- Put GLINKS calls anywhere other than the typed GLINKS adapter.
