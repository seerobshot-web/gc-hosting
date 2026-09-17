import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrderStatus } from "@gch/database";
import {
  InvalidOrderTransitionError,
  OrderTransition,
  canTransition,
  isTerminalStatus,
  nextOrderStatus,
  peekNextOrderStatus,
} from "./order-state-machine";

describe("order-state-machine — valid transitions", () => {
  const cases: Array<[OrderStatus, OrderTransition, OrderStatus]> = [
    [OrderStatus.PENDING, OrderTransition.Pay, OrderStatus.PAID],
    [OrderStatus.PAID, OrderTransition.StartProvisioning, OrderStatus.PROVISIONING],
    [OrderStatus.PROVISIONING, OrderTransition.ProvisioningSucceeded, OrderStatus.ACTIVE],
    [OrderStatus.ACTIVE, OrderTransition.Cancel, OrderStatus.CANCELLED],
    // `fail` is reachable from every non-terminal state.
    [OrderStatus.PENDING, OrderTransition.Fail, OrderStatus.FAILED],
    [OrderStatus.PAID, OrderTransition.Fail, OrderStatus.FAILED],
    [OrderStatus.PROVISIONING, OrderTransition.Fail, OrderStatus.FAILED],
    [OrderStatus.ACTIVE, OrderTransition.Fail, OrderStatus.FAILED],
  ];

  for (const [from, transition, expected] of cases) {
    it(`${from} --${transition}--> ${expected}`, () => {
      assert.equal(nextOrderStatus(from, transition), expected);
      assert.equal(peekNextOrderStatus(from, transition), expected);
      assert.equal(canTransition(from, transition), true);
    });
  }
});

describe("order-state-machine — invalid transitions", () => {
  const cases: Array<[OrderStatus, OrderTransition]> = [
    // Wrong source state for each edge.
    [OrderStatus.PENDING, OrderTransition.StartProvisioning],
    [OrderStatus.PENDING, OrderTransition.ProvisioningSucceeded],
    [OrderStatus.PENDING, OrderTransition.Cancel],
    [OrderStatus.PAID, OrderTransition.Pay],
    [OrderStatus.PAID, OrderTransition.Cancel],
    [OrderStatus.PROVISIONING, OrderTransition.Pay],
    [OrderStatus.ACTIVE, OrderTransition.Pay],
    [OrderStatus.ACTIVE, OrderTransition.StartProvisioning],
    // Terminal states accept nothing — not even `fail`.
    [OrderStatus.CANCELLED, OrderTransition.Cancel],
    [OrderStatus.CANCELLED, OrderTransition.Fail],
    [OrderStatus.FAILED, OrderTransition.Pay],
    [OrderStatus.FAILED, OrderTransition.Fail],
  ];

  for (const [from, transition] of cases) {
    it(`rejects ${from} --${transition}-->`, () => {
      assert.equal(peekNextOrderStatus(from, transition), null);
      assert.equal(canTransition(from, transition), false);
      assert.throws(() => nextOrderStatus(from, transition), InvalidOrderTransitionError);
    });
  }

  it("InvalidOrderTransitionError carries the offending from/transition", () => {
    try {
      nextOrderStatus(OrderStatus.ACTIVE, OrderTransition.Pay);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof InvalidOrderTransitionError);
      assert.equal(err.from, OrderStatus.ACTIVE);
      assert.equal(err.transition, OrderTransition.Pay);
    }
  });
});

describe("order-state-machine — terminal detection", () => {
  it("CANCELLED and FAILED are terminal", () => {
    assert.equal(isTerminalStatus(OrderStatus.CANCELLED), true);
    assert.equal(isTerminalStatus(OrderStatus.FAILED), true);
  });
  it("all other statuses are non-terminal", () => {
    for (const s of [
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PROVISIONING,
      OrderStatus.ACTIVE,
    ]) {
      assert.equal(isTerminalStatus(s), false);
    }
  });
});
