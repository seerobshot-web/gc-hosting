import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateEnv } from "./env.schema";

const validEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: "mysql://user:pass@localhost:3306/gch",
  JWT_ACCESS_SECRET: "a".repeat(32),
  DASHBOARD_API_KEY: "dash-key",
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  RESELLPORTAL_API_KEY: "rp-key",
  RESELLPORTAL_API_SECRET: "rp-secret",
  RESELLPORTAL_BASE_URL: "https://panel.resellportal.com/wp-json/resellportal/v1",
  GLINKS_INTERNAL_SECRET: "glinks-secret",
  GLINKS_BASE_URL: "https://glinks.example.com",
  ALLOWED_ORIGINS: "https://portal.example.com",
};

describe("validateEnv", () => {
  it("passes when every required variable is present and well-formed", () => {
    const result = validateEnv(validEnv);
    assert.equal(result.success, true);
    assert.deepEqual(result.invalidVars, []);
  });

  it("reports each missing variable by NAME (and never its value)", () => {
    const { DATABASE_URL, STRIPE_WEBHOOK_SECRET, ...partial } = validEnv;
    void DATABASE_URL;
    void STRIPE_WEBHOOK_SECRET;

    const result = validateEnv(partial as NodeJS.ProcessEnv);

    assert.equal(result.success, false);
    assert.ok(result.invalidVars.includes("DATABASE_URL"));
    assert.ok(result.invalidVars.includes("STRIPE_WEBHOOK_SECRET"));
    // The message names vars but must not carry any secret values.
    assert.ok(result.message.includes("DATABASE_URL"));
    assert.ok(!result.message.includes("whsec_x"));
  });

  it("rejects a malformed URL variable", () => {
    const result = validateEnv({ ...validEnv, GLINKS_BASE_URL: "not-a-url" });
    assert.equal(result.success, false);
    assert.ok(result.invalidVars.includes("GLINKS_BASE_URL"));
  });
});
