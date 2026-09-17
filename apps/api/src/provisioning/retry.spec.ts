import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { DEFAULT_RETRY_DELAYS_MS, retryWithBackoff } from "./retry";

describe("retryWithBackoff", () => {
  it("returns immediately on first success without sleeping", async () => {
    const sleep = mock.fn(async (_ms: number) => {});
    const fn = mock.fn(async () => "ok");

    const result = await retryWithBackoff(fn, { sleep, delaysMs: [1, 2, 3] });

    assert.equal(result, "ok");
    assert.equal(fn.mock.callCount(), 1);
    assert.equal(sleep.mock.callCount(), 0);
  });

  it("succeeds on the 2nd attempt after one transient failure", async () => {
    const sleep = mock.fn(async (_ms: number) => {});
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return "recovered";
    });

    const result = await retryWithBackoff(fn, { sleep, delaysMs: [1000, 4000, 16000] });

    assert.equal(result, "recovered");
    assert.equal(fn.mock.callCount(), 2);
    // one backoff sleep happened, using the FIRST delay
    assert.equal(sleep.mock.callCount(), 1);
    assert.equal(sleep.mock.calls[0]!.arguments[0], 1000);
  });

  it("exhausts after 3 attempts and rethrows the last error (never sleeps for real)", async () => {
    const sleep = mock.fn(async (_ms: number) => {});
    const fn = mock.fn(async () => {
      throw new Error("still failing");
    });

    await assert.rejects(
      retryWithBackoff(fn, { sleep, delaysMs: [1000, 4000, 16000] }),
      /still failing/,
    );

    assert.equal(fn.mock.callCount(), 3); // 3 attempts
    // sleeps after every failed attempt, following the 1s/4s/16s schedule
    assert.deepEqual(
      sleep.mock.calls.map((c) => c.arguments[0]),
      [1000, 4000, 16000],
    );
  });

  it("invokes onRetry once per failed attempt with a 1-based attempt number", async () => {
    const onRetry = mock.fn((_attempt: number, _err: unknown) => {});
    const fn = mock.fn(async () => {
      throw new Error("nope");
    });

    await assert.rejects(
      retryWithBackoff(fn, { sleep: async () => {}, delaysMs: [0, 0, 0], onRetry }),
    );

    assert.equal(onRetry.mock.callCount(), 3);
    assert.deepEqual(
      onRetry.mock.calls.map((c) => c.arguments[0]),
      [1, 2, 3],
    );
  });

  it("defaults to the documented 1s/4s/16s (=21s) three-attempt schedule", () => {
    assert.deepEqual([...DEFAULT_RETRY_DELAYS_MS], [1000, 4000, 16000]);
    assert.equal(DEFAULT_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0), 21000);
  });
});
