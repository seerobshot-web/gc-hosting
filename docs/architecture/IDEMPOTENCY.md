# Idempotency

GCH coordinates two independent external authorities (Stripe and ResellPortal) with
retries, webhook redelivery, and background polling. Under those conditions the same
logical operation *will* be attempted more than once. Idempotency is therefore not
optional: **every mutating external call carries a deterministic idempotency key**, and
a record of each key is persisted so a repeat is recognized and short-circuited rather
than re-executed.

## Key convention

The idempotency key is a **deterministic** hash of the operation's identity:

```
idempotencyKey = sha256( entityType + ":" + entityId + ":" + operationName )
```

- `entityType` — the kind of entity the operation acts on (e.g. `ProvisioningOrder`,
  `Order`, `Subscription`).
- `entityId` — the stable id of that entity.
- `operationName` — the specific operation (e.g. `placeOrder`, `grantAccess`,
  `chargeInvoice`).

Because the same `(entityType, entityId, operationName)` always hashes to the same key,
a retry of the *same* operation on the *same* entity produces the *same* key — so the
downstream/local ledger recognizes it as a duplicate and does not perform the work
twice.

### Deterministic, NOT UUID-based

The key is **derived from the operation's identity**, never a random UUID and never a
timestamp. This is the crucial property:

- A random UUID generated at call time would differ on every retry, defeating the
  purpose — two attempts at the same operation would look like two different operations.
- A deterministic hash means the caller does not need to remember a previously
  generated key across process restarts, redeliveries, or separate workers; any code
  path can independently recompute the identical key from the entity and operation.

### Reference

```ts
import { createHash } from "node:crypto";

function idempotencyKey(entityType: string, entityId: string, operationName: string) {
  return createHash("sha256")
    .update(`${entityType}:${entityId}:${operationName}`)
    .digest("hex");
}
```

## IdempotencyRecord table

Each attempted operation is recorded in an `IdempotencyRecord` table keyed by the
deterministic key above. Before performing a mutating external call, the code:

1. Computes the deterministic key.
2. Attempts to claim it by inserting an `IdempotencyRecord` (the key column is unique).
3. If the insert **succeeds**, it is the first attempt — perform the operation and
   store the result/status on the record.
4. If the insert **conflicts** (unique violation), the operation was already attempted
   — return the recorded outcome instead of calling the external system again.

This mirrors the existing `WebhookEvent` pattern (claim-first-by-unique-key) already
used for Stripe webhook deliveries, generalized to all mutating external calls.

### TTL policy

`IdempotencyRecord` rows are retained long enough to absorb realistic
retry/redelivery windows, then expired:

| Operation class | TTL | Rationale |
| --- | --- | --- |
| **Most operations** | **24 hours** | Covers webhook redelivery windows, client retries, and transient outages for fast operations. |
| **Provisioning operations** | **7 days** | Provisioning is asynchronous and polled; a service can take far longer to reach `deployed`, and reconciliation may revisit it over days. A longer window prevents a duplicate provider order during that period. |

A record past its TTL is eligible for cleanup. TTLs are chosen so that a key is never
expired while the operation it guards could still legitimately be retried — 24h for
fast operations, 7d for the long-tailed provisioning path.

## Relationship to the "one active service" invariant

Deterministic idempotency on `placeOrder` works together with the DB-level unique
constraint that **one paid GCH order line maps to at most one active provider
service**. Even if idempotency were bypassed, the unique constraint is the last line of
defense against duplicate provisioning; idempotency is the first, ensuring the
duplicate call is never made in the first place.
