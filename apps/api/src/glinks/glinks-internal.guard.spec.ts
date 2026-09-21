import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { GlinksHttpClient } from "./glinks-http.client";
import { GlinksInternalGuard } from "./glinks-internal.guard";

const SECRET = "test-internal-secret";

function clientFor(secret: string | undefined) {
  const config = { get: (key: string) => (key === "GLINKS_INTERNAL_SECRET" ? secret : undefined) } as ConfigService;
  return new GlinksHttpClient(config);
}

function contextFor(headers: Record<string, string | string[] | undefined>, rawBody = "") {
  const req = { headers, rawBody: Buffer.from(rawBody) };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function sign(body: string, timestamp: string) {
  return GlinksHttpClient.computeToken(timestamp, body, SECRET);
}

describe("GlinksInternalGuard", () => {
  it("allows a request with a valid, fresh signature", () => {
    const guard = new GlinksInternalGuard(clientFor(SECRET));
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ event: "ping" });
    const token = sign(body, timestamp);

    const context = contextFor({ "x-timestamp": timestamp, "x-internal-token": token }, body);
    assert.equal(guard.canActivate(context), true);
  });

  it("rejects a missing X-Timestamp or X-Internal-Token header", () => {
    const guard = new GlinksInternalGuard(clientFor(SECRET));
    assert.throws(
      () => guard.canActivate(contextFor({ "x-internal-token": "deadbeef" })),
      UnauthorizedException,
    );
    assert.throws(
      () => guard.canActivate(contextFor({ "x-timestamp": Date.now().toString() })),
      UnauthorizedException,
    );
  });

  it("rejects a non-numeric X-Timestamp", () => {
    const guard = new GlinksInternalGuard(clientFor(SECRET));
    const context = contextFor({ "x-timestamp": "not-a-number", "x-internal-token": "deadbeef" });
    assert.throws(() => guard.canActivate(context), /unix-millis integer/);
  });

  it("rejects a timestamp outside the replay window", () => {
    const guard = new GlinksInternalGuard(clientFor(SECRET));
    const staleTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes old
    const body = "";
    const token = sign(body, staleTimestamp);

    const context = contextFor(
      { "x-timestamp": staleTimestamp, "x-internal-token": token },
      body,
    );
    assert.throws(() => guard.canActivate(context), /replay window/);
  });

  it("rejects a token that does not match the signed body", () => {
    const guard = new GlinksInternalGuard(clientFor(SECRET));
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ event: "ping" });
    const wrongToken = sign(JSON.stringify({ event: "tampered" }), timestamp);

    const context = contextFor(
      { "x-timestamp": timestamp, "x-internal-token": wrongToken },
      body,
    );
    assert.throws(() => guard.canActivate(context), /Invalid X-Internal-Token/);
  });

  it("takes the first value when a header repeats", () => {
    const guard = new GlinksInternalGuard(clientFor(SECRET));
    const timestamp = Date.now().toString();
    const body = "";
    const token = sign(body, timestamp);

    const context = contextFor(
      { "x-timestamp": [timestamp, "ignored"], "x-internal-token": [token, "ignored"] },
      body,
    );
    assert.equal(guard.canActivate(context), true);
  });
});
