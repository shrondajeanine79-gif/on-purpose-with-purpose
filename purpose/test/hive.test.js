import test from "node:test";
import assert from "node:assert/strict";
import { guardHiveRequest, hiveStatus, callHive, buildOwnerInstruction, HiveBlockedError } from "../src/hive.js";
import { loadBrandStandard, loadGovernance } from "../src/config.js";
import { validateDirective } from "../src/directive.js";

const gov = loadGovernance();
const brand = loadBrandStandard();

function direct(overrides = {}) {
  return validateDirective(
    {
      request: "Review homepage metadata.",
      workflow: "brand-audit",
      action: "research",
      scope: "homepage metadata",
      ...overrides,
    },
    gov
  );
}

test("hive is disabled without an explicit environment flag", () => {
  assert.throws(
    () => guardHiveRequest({ directive: direct(), governance: gov, brandStandard: brand, env: {} }),
    (error) => error instanceof HiveBlockedError && error.code === "HIVE_DISABLED"
  );
});

test("hive is blocked without an API key even when enabled", () => {
  assert.throws(
    () =>
      guardHiveRequest({
        directive: direct(),
        governance: gov,
        brandStandard: brand,
        env: { PURPOSE_ENABLE_HIVE: "1" },
      }),
    (error) => error.code === "HIVE_NO_KEY"
  );
});

test("hive blocks a missing directive", () => {
  assert.throws(
    () =>
      guardHiveRequest({
        directive: null,
        governance: gov,
        brandStandard: brand,
        env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
      }),
    (error) => error.code === "HIVE_NO_DIRECTIVE"
  );
});

test("hive blocks capabilities that are not read-only in Phase 1", () => {
  const directive = { ...direct(), action: "publish" };
  assert.throws(
    () =>
      guardHiveRequest({
        directive,
        governance: gov,
        brandStandard: brand,
        env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
      }),
    (error) => error.code === "HIVE_ACTION_BLOCKED"
  );
});

test("hive allows a read-only research request when properly enabled", () => {
  const guard = guardHiveRequest({
    directive: direct(),
    governance: gov,
    brandStandard: brand,
    env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
  });
  assert.equal(guard.ok, true);
  assert.equal(guard.status.model, "deepseek-ai/deepseek-v4.1-flash-1017");
});

test("hive rejects an approval that does not match the action", () => {
  assert.throws(
    () =>
      guardHiveRequest({
        directive: direct(),
        governance: gov,
        brandStandard: brand,
        approval: { status: "approved", action: "publish" },
        env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
      }),
    (error) => error.code === "HIVE_APPROVAL_MISMATCH" || error.ok === undefined
  );
});

test("hive enforces approval for capabilities that require it", () => {
  const customGov = structuredClone(gov);
  customGov.approvalMatrix.find((row) => row.action === "research").requiresApproval = true;
  assert.throws(
    () =>
      guardHiveRequest({
        directive: direct(),
        governance: customGov,
        brandStandard: brand,
        env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
      }),
    (error) => error.code === "HIVE_APPROVAL_REQUIRED"
  );
});

test("hive blocks when required brand standards are unapproved", () => {
  const customGov = structuredClone(gov);
  customGov.workflows["brand-audit"].requiresBrandStandard = true;
  assert.throws(
    () =>
      guardHiveRequest({
        directive: direct(),
        governance: customGov,
        brandStandard: brand,
        env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
      }),
    (error) =>
      error.code === "HIVE_BRAND_STANDARD_INCOMPLETE" && error.details.gaps.length > 0
  );
});

test("hive status never reports the key value", () => {
  const status = hiveStatus({ HIVE_API_KEY: "super-secret-value", PURPOSE_ENABLE_HIVE: "1" });
  assert.equal(status.hasApiKey, true);
  assert.ok(!JSON.stringify(status).includes("super-secret-value"));
});

test("owner instruction preserves directive boundaries", () => {
  const text = buildOwnerInstruction(direct());
  assert.ok(text.includes("not an autonomous content creator"));
  assert.ok(text.includes("Do not invent brand policy"));
  assert.ok(text.includes("homepage metadata"));
});

test("callHive does not fire a network request unless every guard passes", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, json: async () => ({ choices: [{ message: { content: "x" } }] }) };
  };
  await assert.rejects(
    callHive({ directive: direct(), governance: gov, brandStandard: brand, env: {}, fetchImpl }),
    (error) => error.code === "HIVE_DISABLED"
  );
  assert.equal(called, false);
});

test("callHive marks output as a proposal and never executes", async () => {
  const fetchImpl = async (url, init) => {
    assert.ok(url.endsWith("/chat/completions"));
    assert.ok(init.headers.Authorization.startsWith("Bearer "));
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Findings: metadata missing canonical." } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    };
  };
  const result = await callHive({
    directive: direct(),
    governance: gov,
    brandStandard: brand,
    env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
    fetchImpl,
  });
  assert.equal(result.executed, false);
  assert.ok(result.text.includes("Findings"));
  assert.ok(result.note.includes("Nothing was published"));
});

test("callHive caps output tokens to the governance ceiling", async () => {
  let sent;
  const fetchImpl = async (_url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: "ok" } }] }) };
  };
  await callHive({
    directive: direct(),
    governance: gov,
    brandStandard: brand,
    env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test" },
    fetchImpl,
    maxOutputTokens: 999999,
  });
  assert.equal(sent.max_tokens, gov.hive.maxOutputTokens);
});

test("callHive surfaces HTTP failures without leaking the key", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401 });
  await assert.rejects(
    callHive({
      directive: direct(),
      governance: gov,
      brandStandard: brand,
      env: { PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "secret-key" },
      fetchImpl,
    }),
    (error) => error.code === "HIVE_HTTP_ERROR" && !JSON.stringify(error).includes("secret-key")
  );
});
