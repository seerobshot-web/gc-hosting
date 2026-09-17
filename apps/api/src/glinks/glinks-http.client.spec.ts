import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { GlinksHttpClient } from "./glinks-http.client";

const SECRET = "test-internal-secret";
const TIMESTAMP = "1700000000000";
const BODY = JSON.stringify({ action: "ping", n: 1 });

function clientFor(values: Record<string, string | undefined>) {
  const config = { get: (key: string) => values[key] } as ConfigService;
  return new GlinksHttpClient(config);
}

describe("GlinksHttpClient signing", () => {
  it("computes a deterministic HMAC-SHA256 over `${timestamp}:${body}`", () => {
    const expected = createHmac("sha256", SECRET)
      .update(`${TIMESTAMP}:${BODY}`)
      .digest("hex");

    const a = GlinksHttpClient.computeToken(TIMESTAMP, BODY, SECRET);
    const b = GlinksHttpClient.computeToken(TIMESTAMP, BODY, SECRET);

    assert.equal(a, expected);
    assert.equal(a, b); // deterministic for identical inputs
  });

  it("produces a different signature when the secret differs", () => {
    const withRight = GlinksHttpClient.computeToken(TIMESTAMP, BODY, SECRET);
    const withWrong = GlinksHttpClient.computeToken(TIMESTAMP, BODY, "wrong-secret");

    assert.notEqual(withRight, withWrong);
  });

  it("changes the signature when the body or timestamp changes", () => {
    const base = GlinksHttpClient.computeToken(TIMESTAMP, BODY, SECRET);
    assert.notEqual(base, GlinksHttpClient.computeToken(TIMESTAMP, `${BODY} `, SECRET));
    assert.notEqual(base, GlinksHttpClient.computeToken("1700000000001", BODY, SECRET));
  });

  it("sign() returns the timestamp and a matching token from env secret", () => {
    const client = clientFor({ GLINKS_INTERNAL_SECRET: SECRET });
    const sig = client.sign(BODY, TIMESTAMP);

    assert.equal(sig.timestamp, TIMESTAMP);
    assert.equal(sig.token, GlinksHttpClient.computeToken(TIMESTAMP, BODY, SECRET));
    assert.equal(client.verify(TIMESTAMP, BODY, sig.token), true);
    assert.equal(client.verify(TIMESTAMP, BODY, "deadbeef"), false);
  });

  it("throws a named error when GLINKS_INTERNAL_SECRET is missing", () => {
    const client = clientFor({});
    assert.throws(() => client.sign(BODY, TIMESTAMP), /GLINKS_INTERNAL_SECRET is not set/);
  });
});
