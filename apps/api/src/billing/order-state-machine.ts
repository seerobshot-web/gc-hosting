import { OrderStatus } from "@gch/database";

/**
 * The GCH-ALEPH order lifecycle, encoded as PURE functions — no DB access, no
 * Stripe calls, no logging, no side effects of any kind. This module is the
 * single source of truth for "which status can follow which"; the webhook /
 * provisioning services are the only place transitions are actually persisted
 * and audited (invalid transitions are rejected here and logged by the caller).
 *
 *   PENDING      --pay-------------------> PAID       (checkout.session.completed)
 *   PAID         --start_provisioning----> PROVISIONING
 *   PROVISIONING --provisioning_succeeded-> ACTIVE
 *   ACTIVE       --cancel----------------> CANCELLED  (subscription cancelled)
 *   *            --fail------------------> FAILED     (terminal error, any state)
 */

/** The logical event that drives a transition, decoupled from Stripe types. */
export enum OrderTransition {
  /** Payment confirmed by Stripe. */
  Pay = "pay",
  /** Provisioning has begun against the fulfillment provider. */
  StartProvisioning = "start_provisioning",
  /** Provider reports the service is live. */
  ProvisioningSucceeded = "provisioning_succeeded",
  /** Subscription cancelled — access is revoked. */
  Cancel = "cancel",
  /** Unrecoverable error — terminal, reachable from any non-terminal state. */
  Fail = "fail",
}

/**
 * Allowed (from -> transition -> to) edges. `Fail` is handled separately
 * because it is legal from every non-terminal state.
 */
const TRANSITIONS: ReadonlyArray<{
  from: OrderStatus;
  transition: OrderTransition;
  to: OrderStatus;
}> = [
  { from: OrderStatus.PENDING, transition: OrderTransition.Pay, to: OrderStatus.PAID },
  {
    from: OrderStatus.PAID,
    transition: OrderTransition.StartProvisioning,
    to: OrderStatus.PROVISIONING,
  },
  {
    from: OrderStatus.PROVISIONING,
    transition: OrderTransition.ProvisioningSucceeded,
    to: OrderStatus.ACTIVE,
  },
  { from: OrderStatus.ACTIVE, transition: OrderTransition.Cancel, to: OrderStatus.CANCELLED },
];

/** Statuses that accept no further transitions. */
const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
]);

/** Raised when a transition is not permitted from the current status. */
export class InvalidOrderTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly transition: OrderTransition,
  ) {
    super(`Invalid order transition '${transition}' from status '${from}'`);
    this.name = "InvalidOrderTransitionError";
  }
}

/**
 * The next status for `from` under `transition`, or `null` if the transition
 * is not permitted. Pure — never throws, never touches I/O.
 */
export function peekNextOrderStatus(
  from: OrderStatus,
  transition: OrderTransition,
): OrderStatus | null {
  // `fail` is terminal-from-anywhere, but a status that is already terminal
  // accepts nothing further (including another fail).
  if (transition === OrderTransition.Fail) {
    return TERMINAL_STATUSES.has(from) ? null : OrderStatus.FAILED;
  }
  const edge = TRANSITIONS.find((e) => e.from === from && e.transition === transition);
  return edge ? edge.to : null;
}

/** True when `transition` is permitted from `from`. Pure. */
export function canTransition(from: OrderStatus, transition: OrderTransition): boolean {
  return peekNextOrderStatus(from, transition) !== null;
}

/**
 * The next status for `from` under `transition`, throwing
 * {@link InvalidOrderTransitionError} when the transition is not permitted.
 * Pure apart from the throw; the CALLER is responsible for auditing/logging
 * the rejection.
 */
export function nextOrderStatus(from: OrderStatus, transition: OrderTransition): OrderStatus {
  const next = peekNextOrderStatus(from, transition);
  if (next === null) throw new InvalidOrderTransitionError(from, transition);
  return next;
}

/** True when `status` accepts no further transitions. Pure. */
export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
