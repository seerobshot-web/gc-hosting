# ResellersPanel (RSP) Error Codes

> **Scope / important caveat.** GCH **never calls ResellersPanel (RSP) directly.**
> Fulfillment goes through **ResellPortal's panel API**, and ResellPortal is the
> authority on fulfillment (see [AUTHORITY-BOUNDARIES.md](./AUTHORITY-BOUNDARIES.md)).
> The RSP-style numeric codes below can surface *inside* ResellPortal responses or
> logs, so this table exists purely as a **debugging / interpretation reference**. It
> is **not** a contract GCH integrates against, and no GCH code path should be written
> to call RSP directly.

## Code reference

| Code | Meaning | Debugging note |
| --- | --- | --- |
| `0` | **OK / success** | The operation succeeded. |
| `1` | **INVALID_LOGIN** | Authentication to the panel failed — bad or missing panel credentials. |
| `6` | **INVALID_INPUT** | A request field was malformed or missing. Check the payload shape. |
| `18` | **PLAN_NOT_EXISTS** | The referenced plan does not exist in the panel. Verify the plan identifier mapping. |
| `27` | **INVALID_USERNAME_PASSWORD** | The account username/password pair (e.g. for the provisioned service) was rejected. |
| `36` | **INVALID_PLAN** | The plan reference is not valid for this operation/context. |
| `37` | **PLAN_DISABLED** | The plan exists but is disabled and cannot be ordered. |

## How to use this reference

- When ResellPortal returns or logs one of these numeric codes, use this table to
  interpret what the underlying panel reported.
- A non-zero code seen during provisioning should be treated as a fulfillment problem
  surfaced by ResellPortal — handle it via the provisioning/reconciliation path, not by
  calling RSP directly.
- Because GCH does not integrate with RSP directly, these codes should never appear in
  a GCH adapter that targets RSP — if one did, that adapter would itself be a boundary
  violation.
