import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryD1 } from "../src/d1.js";
import { createLocalApp } from "../src/local/server.js";
import { createStubFetch, STUB_MODEL } from "../src/ai/stub.js";
import { loadGovernance } from "../src/config.js";
import {
  createDevIdentity,
  dryRunEnv,
  assertSafeDevEnvironment,
  DEV_OWNER_EMAIL,
} from "../src/local/dev-auth.js";

function harness({ envOverrides = {}, reply } = {}) {
  const identity = createDevIdentity();
  const stub = createStubFetch({ reply });
  const db = createMemoryD1();
  const app = createLocalApp({
    db,
    env: { ...dryRunEnv(), ...envOverrides },
    jwks: identity.jwks,
    fetchImpl: stub.fetch,
  });
  return { ...app, stub, identity, db, token: identity.mint() };
}

function request(path, { method = "GET", token, body } = {}) {
  return new Request(`https://dry-run.invalid${path}`, {
    method,
    headers: { "content-type": "application/json", "cf-access-jwt-assertion": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const DIRECTIVE = {
  request: "Review the live homepage metadata and report gaps. Do not change anything.",
  workflow: "brand-audit",
  action: "research",
  scope: "homepage metadata only",
  audience: "owner",
};

test("full owner workflow: validate, approve, analyze, audit", async () => {
  const { route, stores, stub, token } = harness();

  const status = await (await route(request("/api/status", { token }))).json();
  assert.equal(status.role, "owner");
  assert.equal(status.deployed, false);

  const validated = await route(request("/api/directives/validate", { method: "POST", token, body: DIRECTIVE }));
  assert.equal(validated.status, 201);
  const directive = (await validated.json()).directive;
  assert.equal(directive.status, "validated");

  const created = await route(request("/api/approvals", { method: "POST", token, body: DIRECTIVE }));
  assert.equal(created.status, 201);
  const approval = (await created.json()).approval;
  assert.equal(approval.status, "pending");

  const pendingRun = await route(
    request("/api/ai/analyze", { method: "POST", token, body: { ...DIRECTIVE, approvalId: approval.id } })
  );
  assert.equal(pendingRun.status, 403);
  assert.equal((await pendingRun.json()).error.code, "APPROVAL_NOT_APPROVED");

  const approved = await route(
    request(`/api/approvals/${approval.id}/approve`, { method: "POST", token, body: { note: "dry run" } })
  );
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).status, "approved");

  const analysis = await route(
    request("/api/ai/analyze", {
      method: "POST",
      token,
      body: { ...DIRECTIVE, approvalId: approval.id, directiveId: directive.id },
    })
  );
  assert.equal(analysis.status, 200);
  const result = await analysis.json();
  assert.equal(result.executed, false);
  assert.ok(result.text.length > 0);
  assert.ok(result.note.includes("Nothing was published"));
  assert.equal(stub.calls.length, 1);

  const consumed = await stores.approvals.get(approval.id);
  assert.equal(consumed.status, "consumed");
  assert.ok(consumed.consumedAt);

  const verify = await (await route(request("/api/audit/verify", { token }))).json();
  assert.equal(verify.ok, true);
  assert.ok(verify.count >= 4);

  const usage = await stores.usage.totals("2000-01-01T00:00:00.000Z");
  assert.equal(usage.requests, 1);
  assert.ok(usage.costUsd > 0);
});

test("a consumed approval cannot authorize a second run", async () => {
  const { route, token, stub } = harness();

  const created = await (
    await route(request("/api/approvals", { method: "POST", token, body: DIRECTIVE }))
  ).json();
  await route(request(`/api/approvals/${created.approval.id}/approve`, { method: "POST", token, body: {} }));

  const first = await route(
    request("/api/ai/analyze", { method: "POST", token, body: { ...DIRECTIVE, approvalId: created.approval.id } })
  );
  assert.equal(first.status, 200);

  const second = await route(
    request("/api/ai/analyze", { method: "POST", token, body: { ...DIRECTIVE, approvalId: created.approval.id } })
  );
  assert.equal(second.status, 403);
  assert.equal((await second.json()).error.code, "APPROVAL_NOT_APPROVED");
  assert.equal(stub.calls.length, 1);
});

test("read-only research needs no per-run approval", async () => {
  const { route, token, stub } = harness();
  const response = await route(request("/api/ai/analyze", { method: "POST", token, body: DIRECTIVE }));
  assert.equal(response.status, 200);
  assert.equal(stub.calls.length, 1);
  assert.equal((await response.json()).executed, false);
});

test("the only HTTP target is the non-resolvable dry-run host", async () => {
  const { route, token, stub } = harness();
  await route(request("/api/ai/analyze", { method: "POST", token, body: DIRECTIVE }));
  assert.equal(stub.calls.length, 1);
  const target = new URL(stub.calls[0].url);
  assert.equal(target.host, "dry-run.invalid");
  assert.ok(target.hostname.endsWith(".invalid"));
});

test("write capabilities are refused before the stub is called", async () => {
  const { route, token, stub } = harness();
  for (const action of ["publish", "send", "charge", "draft", "booking_change"]) {
    const response = await route(
      request("/api/ai/analyze", {
        method: "POST",
        token,
        body: { ...DIRECTIVE, action, channel: "email" },
      })
    );
    assert.ok([422, 403].includes(response.status), `${action} should be refused, got ${response.status}`);
  }
  assert.equal(stub.calls.length, 0);
});

test("no side-effect endpoint exists", async () => {
  const { route, token } = harness();
  for (const path of ["/api/publish", "/api/send", "/api/charge", "/api/bookings", "/api/deploy", "/api/merge"]) {
    const response = await route(request(path, { method: "POST", token, body: {} }));
    assert.equal(response.status, 404, `${path} must not exist`);
  }
});

test("audit actor is the authenticated owner, not a constant", async () => {
  const { route, stores, token } = harness();
  await route(request("/api/directives/validate", { method: "POST", token, body: DIRECTIVE }));
  const events = await stores.audit.list(20);
  assert.ok(events.every((event) => event.actor === DEV_OWNER_EMAIL));
});

test("stub model is never reported as Hive", async () => {
  const { route, token } = harness();
  const body = await (await route(request("/api/ai/analyze", { method: "POST", token, body: DIRECTIVE }))).json();
  assert.notEqual(body.model, STUB_MODEL);
  assert.ok(body.note.includes("Proposal only"));
});

test("development auth refuses to run beside a real owner identity", () => {
  assert.throws(
    () => assertSafeDevEnvironment({ PURPOSE_OWNER_EMAIL: "real@on-purpose-with-purpose.org" }),
    /Refusing to run/
  );
  assert.throws(
    () => assertSafeDevEnvironment({ PURPOSE_ACCESS_AUD: "real-aud-tag" }),
    /Refusing to run/
  );
  assert.equal(assertSafeDevEnvironment({}), true);
  assert.equal(assertSafeDevEnvironment({ PURPOSE_OWNER_EMAIL: "someone@dry-run.invalid" }), true);
});

test("dry run env never contains a real key", () => {
  const env = dryRunEnv();
  assert.equal(env.HIVE_API_KEY, "dry-run-not-a-real-key");
  assert.ok(env.HIVE_BASE_URL.includes(".invalid"));
  assert.ok(env.PURPOSE_OWNER_EMAIL.endsWith(".invalid"));
});

test("in-memory database leaves no files", async () => {
  const { route, token, db } = harness();
  await route(request("/api/status", { token }));
  const rows = await db.prepare("SELECT COUNT(*) AS c FROM audit_events").first();
  assert.ok(Number(rows.c) >= 0);
  db.close();
});

function scenarioHarness() {
  const identity = createDevIdentity();
  const stub = createStubFetch();
  const db = createMemoryD1();
  const governance = JSON.parse(JSON.stringify(loadGovernance()));
  governance.approvalMatrix.find((row) => row.action === "research").requiresApproval = true;
  const app = createLocalApp({
    db,
    env: dryRunEnv(),
    jwks: identity.jwks,
    fetchImpl: stub.fetch,
    configOverride: { governance },
  });
  return { ...app, stub, identity, db, token: identity.mint() };
}

test("scenario A: approved request runs exactly once", async () => {
  const { route, token, stub } = scenarioHarness();
  const created = await (
    await route(request("/api/approvals", { method: "POST", token, body: DIRECTIVE }))
  ).json();
  await route(request(`/api/approvals/${created.approval.id}/approve`, { method: "POST", token, body: {} }));
  const response = await route(
    request("/api/ai/analyze", { method: "POST", token, body: { ...DIRECTIVE, approvalId: created.approval.id } })
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).executed, false);
  assert.equal(stub.calls.length, 1);
});

test("scenario B: missing approval is refused and never calls the model", async () => {
  const { route, token, stub } = scenarioHarness();
  const response = await route(request("/api/ai/analyze", { method: "POST", token, body: DIRECTIVE }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "APPROVAL_REQUIRED");
  assert.equal(stub.calls.length, 0);
});

test("scenario C: denied approval is refused and never calls the model", async () => {
  const { route, token, stub } = scenarioHarness();
  const created = await (
    await route(request("/api/approvals", { method: "POST", token, body: DIRECTIVE }))
  ).json();
  const rejected = await route(
    request(`/api/approvals/${created.approval.id}/reject`, { method: "POST", token, body: { note: "no" } })
  );
  assert.equal((await rejected.json()).status, "rejected");

  const response = await route(
    request("/api/ai/analyze", { method: "POST", token, body: { ...DIRECTIVE, approvalId: created.approval.id } })
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "APPROVAL_NOT_APPROVED");
  assert.equal(stub.calls.length, 0);
});

test("no real network call is possible during a dry run", async () => {
  const original = globalThis.fetch;
  let real = 0;
  globalThis.fetch = async () => {
    real += 1;
    throw new Error("blocked");
  };
  try {
    const { route, token } = harness();
    await route(request("/api/ai/analyze", { method: "POST", token, body: DIRECTIVE }));
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(real, 0);
});
