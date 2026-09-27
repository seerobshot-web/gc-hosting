# Audit ownership: action–target evidence and reviewer decisions

> **Superseded 2026-09-27**: all 28 pairs (30 producer occurrences) are now
> recorded as approved, with file:line evidence and a named owner, in
> [`AUDIT-PHASE3-APPROVAL-RECORD.md`](./AUDIT-PHASE3-APPROVAL-RECORD.md).
> This document remains as the evidence and design history behind those
> decisions.

**State: 28 pending decisions.** This register supplements `AUDIT-PHASE3-APPROVAL-CLOSURE.md`; neither observed source code nor a merged PR approves historical attribution, a production allowlist, or a write path. The scope policy is pure and unconnected. No schema, audit writer, resolver, database scanner, or read route changes accompany this document.

## Observed producer inventory

Compared the 28 action–target entries in the Phase 3 register with the active write sites in the ten API writer files and `workers/cron-jobs/src/resellportal-poller.ts`. All 28 pairs have a matching writer occurrence. `membership.created` has both a membership service and auth auto-join producer. `order.deployed` has an API poller and a direct cron writer. These are distinct paths requiring separate fixtures. Provider service actions in `provisioning.service.ts` are imported constants; their event meanings need explicit review, not an inference from the string.

The existing `AuditLog` model has no tenant key. A candidate relation below is a proposed PK-bound path from a *surviving* GCH row, never ownership proof for a deleted row. Context and relation candidate authenticity must be established in a future reviewed server implementation. No historical audit rows were inspected.

| # | Action → target | Observed producer path (under `apps/api/src` unless absolute) | Proposed FK evidence, pending approval | Decision / owners |
| --- | --- | --- | --- | --- |
| 1 | `org.created` → `Org` | `orgs/orgs.service.ts` | `targetId = Org.id`; candidate `Org.id` | **Pending**: domain + security owners unassigned |
| 2 | `org.updated` → `Org` | `orgs/orgs.service.ts` | `targetId = Org.id`; candidate `Org.id` | **Pending**: domain + security owners unassigned |
| 3 | `domain.added` → `OrgDomainVerification` | `orgs/domains.service.ts` | `targetId = OrgDomainVerification.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 4 | `domain.verified` → `OrgDomainVerification` | `orgs/domains.service.ts` | `targetId = OrgDomainVerification.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 5 | `domain.removed` → `OrgDomainVerification` | `orgs/domains.service.ts` | `targetId = OrgDomainVerification.id`; candidate `target.orgId before deletion` | **Pending**: domain + security owners unassigned |
| 6 | `membership.created` → `Membership` | `memberships/memberships.service.ts; auth/auth.service.ts` | `targetId = Membership.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 7 | `membership.role_changed` → `Membership` | `memberships/memberships.service.ts` | `targetId = Membership.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 8 | `membership.removed` → `Membership` | `memberships/memberships.service.ts` | `targetId = Membership.id`; candidate `target.orgId before deletion` | **Pending**: domain + security owners unassigned |
| 9 | `invitation.sent` → `Invitation` | `invitations/invitations.service.ts` | `targetId = Invitation.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 10 | `invitation.resent` → `Invitation` | `invitations/invitations.service.ts` | `targetId = Invitation.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 11 | `invitation.revoked` → `Invitation` | `invitations/invitations.service.ts` | `targetId = Invitation.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 12 | `invitation.accepted` → `Invitation` | `invitations/invitations.service.ts` | `targetId = Invitation.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 13 | `subscription.seats_synced` → `Subscription` | `billing/billing.service.ts` | `targetId = Subscription.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 14 | `billing.checkout_started` → `Org` | `billing/billing.service.ts` | `targetId = Org.id`; candidate `Org.id` | **Pending**: domain + security owners unassigned |
| 15 | `order.paid` → `Order` | `billing/stripe-webhook.service.ts` | `targetId = Order.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 16 | `order.cancelled` → `Order` | `billing/stripe-webhook.service.ts` | `targetId = Order.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 17 | `order.transition_rejected` → `Order` | `billing/stripe-webhook.service.ts` | `targetId = Order.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 18 | `subscription.status_changed` → `Subscription` | `billing/stripe-webhook.service.ts` | `targetId = Subscription.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 19 | `invoice.paid` → `Invoice` | `billing/stripe-webhook.service.ts` | `targetId = Invoice.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 20 | `invoice.payment_failed` → `Invoice` | `billing/stripe-webhook.service.ts` | `targetId = Invoice.id`; candidate `target.orgId` | **Pending**: domain + security owners unassigned |
| 21 | `service.provisioned` → `ProviderService` | `provisioning/provisioning.service.ts` | `targetId = ProviderService.id`; candidate `service.order.orgId` | **Pending**: domain + security owners unassigned |
| 22 | `service.provisioning_failed` → `ProviderService` | `provisioning/provisioning.service.ts` | `targetId = ProviderService.id`; candidate `service.order.orgId` | **Pending**: domain + security owners unassigned |
| 23 | `service.suspended` → `ProviderService` | `provisioning/provisioning.service.ts` | `targetId = ProviderService.id`; candidate `service.order.orgId` | **Pending**: domain + security owners unassigned |
| 24 | `service.terminated` → `ProviderService` | `provisioning/provisioning.service.ts` | `targetId = ProviderService.id`; candidate `service.order.orgId` | **Pending**: domain + security owners unassigned |
| 25 | `order.placed` → `ProvisioningOrder` | `provisioning/provisioning.service.ts` | `targetId = ProvisioningOrder.id`; candidate `order.client.orgId` | **Pending**: domain + security owners unassigned |
| 26 | `order.failed` → `ProvisioningOrder` | `provisioning/provisioning.service.ts` | `targetId = ProvisioningOrder.id`; candidate `order.client.orgId` | **Pending**: domain + security owners unassigned |
| 27 | `order.deployed` → `ProvisioningOrder` | `provisioning/provisioning.service.ts; workers/cron-jobs/src/resellportal-poller.ts` | `targetId = ProvisioningOrder.id`; candidate `order.client.orgId` | **Pending**: domain + security owners unassigned |
| 28 | `order.recovery_review_required` → `Order` | `provisioning/paid-order-recovery.service.ts` | `targetId = Order.id`; candidate `Order.orgId` | **Pending**: domain + security owners unassigned |

## Required per-row reviewer record

Record one approval entry **per numbered pair** above, including separate sign-offs for both producer paths on rows 6 and 27. Do not replace an absent decision with a blanket approval of the table.

```text
Pair number and exact action/target:
Observed targetId expression and PK lookup (file and line):
Event meaning and producer(s):
Approved GCH FK paths and all independently available candidates:
Trusted server principal and tenant context provenance:
Cardinality and explicit zero/multiple-result behavior:
Target deleted / intermediate row deleted:
Relation conflict / previously scoped row disagreement:
Orphan, malformed shape and unsupported action:
Fixture IDs (synthetic only) and positive/negative test names:
Sanitized historical shape count and production evidence reference (aggregate only):
Domain decision owner (named) / security decision owner (named):
Decision: approved | pending | ambiguous | unsupported | blocked
Date and review record:
```

**Minimum common negative fixtures for each pair:** wrong action against a valid target type; valid action with wrong target type; target PK belonging to another tenant; forged principal/context; deleted target; missing intermediate relation; conflicting independent organization candidates or persisted scope; empty/malformed target ID; actor, browser body, email and metadata claiming another tenant; repeat delivery. Assert no organization assignment in every negative outcome. For matched pairs test exact PK binding and that the emitted event retains its original fields. Test aggregate-only output without IDs, credentials or payment data.

**Specific high-risk cases requiring separate evidence:** Rows 5 and 8 delete their target and cannot be retrospectively resolved by a nonexistent target row. Row 12 uses a verified invitation token path, which is not automatically equivalent to a member session. Rows 15–20 are webhook-derived; a local payment state or externally supplied ID is not tenant proof. Rows 21–24 require both `ProviderService` and `Order` to survive. Rows 25–27 require both `ProvisioningOrder` and `Client`; the direct cron path has no guard-derived principal. Row 27 needs independent API and cron fixtures. Row 28 cannot use a local paid flag as tenant evidence. Historical unknown pairs remain `unsupported_event_shape` until independently inventoried.

## Classification and release constraints

A missing/deleted target with no approved surviving relation remains unassigned; a conflicting candidate remains ambiguous; malformed evidence is invalid; an action–target pair absent from the approved allowlist is unsupported. A matching surviving PK path is only a candidate until reviewed against server principal provenance and event meaning. Neither actor, free-form metadata, browser input, email/domain, provider IDs, nor paid/provisioned flags may assign tenant scope. Avoid first-match lookups. Redact audit IDs, target IDs, candidate org IDs and raw exceptions from ordinary review output.

Require **named** domain and security owners for all 28 decisions and runtime binding review. The FK delete action, future audit query/index, migration and rollback owners, operational database inventory/lock budget and disposable MySQL setup remain independent blocked approvals. Retain `GET /audit` at 400 for missing scope, 404 for nonmembers, 503 for authorized members while ownership is unavailable, and zero audit-row reads on that path. A future migration or reader cannot be inferred from this register.

## Checks and limitations

The inventory is source-based and may omit historical event shapes from removed writers or legacy rows. A sanitized aggregate-only database inventory, independently approved before any real database access, is required to decide whether historical shapes extend beyond these 28 pairs. Fixture passing is evidence of implementation behavior, not approval. This documentation performs no audit-row read, migration, backfill, provider call, payment action, deployment, provisioning or entitlement change.
