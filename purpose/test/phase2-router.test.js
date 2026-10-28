import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryD1 } from "../src/d1.js";
import { createLocalApp } from "../src/local/server.js";
import { createKeyPair, mintJwt, TEST_ENV } from "./helpers/jwt-mint.js";

const keys = createKeyPair("RS256");
const OWNER = "owner@example.com";

function token(overrides = {}) {
  return mintJwt(keys, { email: OWNER, ...overrides });
}

function app(envOverrides = {}) {
  const db = createMemoryD1();
  const instance = createLocalApp({
    db,
    env: { ...TEST_ENV, ...envOverrides },
    jwks: keys.jwks,
  });
  return { db, ...instance };
}

function req(path, { method = "GET", body, jwt, extraHeaders = {} } = {}) {
  const headers = {
    "content-type": "application/json",
    ...(jwt === null ? {} : { "cf-access-jwt-assertion": jwt ?? token() }),
    ...extraHeaders,
  };
  return new Request(`https://purpose.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("no route works without a token", async () => {
  const { route } = app();
  const response = await route(req("/api/status", { jwt: null }));
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, "AUTH_MISSING");
});

test("status is available to the verified owner", async () => {
  const { route } = app();
  const response = await route(req("/api/status"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.project, "PURPOSE");
  assert.equal(body.role, "owner");
  assert.equal(body.deployed, false);
  assert.equal(body.owner, "OWNER@example.com".toLowerCase());
});

test("status never exposes the API key", async () => {
  const { route } = app({ HIVE_API_KEY: "sk-super-secret-value-1234567890" });
  const response = await route(req("/api/status"));
  const text = await response.text();
  assert.ok(!text.includes("super-secret"));
  assert.ok(text.includes('"configured": true'));
});

test("non-owner is rejected with 403", async () => {
  const { route } = app();
  const response = await route(req("/api/status", { jwt: token({ email: "intruder@example.com" }) }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "AUTH_NOT_OWNER");
});

test("security headers are set", async () => {
  const { route } = app();
  const response = await route(req("/api/status"));
  for (const header of ["x-content-type-options", "referrer-policy", "x-frame-options", "cache-control"]) {
    assert.ok(response.headers.get(header), `missing ${header}`);
  }
});

test("brand endpoint reports gaps and not-ready", async () => {
  const { route } = app();
  const body = await (await route(req("/api/brand"))).json();
  assert.equal(body.readiness.ready, false);
  assert.ok(body.gaps.required.length > 0);
});

test("inventory is read-only and preserves published URLs", async () => {
  const { route } = app();
  const body = await (await route(req("/api/inventory"))).json();
  assert.equal(body.readOnly, true);
  assert.ok(body.linkInBio.some((entry) => entry.url === "https://youtube.com"));
  assert.ok(body.missingAssets.includes("logo"));
  assert.ok(body.flagged.length > 0);
});

test("directive validation accepts a bounded read-only request", async () => {
  const { route } = app();
  const response = await route(
    req("/api/directives/validate", {
      method: "POST",
      body: {
        request: "Review homepage metadata.",
        workflow: "brand-audit",
        action: "research",
        scope: "homepage metadata",
      },
    })
  );
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.directive.status, "validated");
});

test("directive validation rejects publish", async () => {
  const { route } = app();
  const response = await route(
    req("/api/directives/validate", {
      method: "POST",
      body: {
        request: "publish it",
        workflow: "brand-audit",
        action: "publish",
        scope: "homepage",
        audience: "public",
        channel: "site",
      },
    })
  );
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "ACTION_NOT_ALLOWED");
});

test("approval creation is pending, never auto-approved", async () => {
  const { route } = app();
  const response = await route(
    req("/api/approvals", {
      method: "POST",
      body: {
        request: "Review homepage metadata.",
        workflow: "brand-audit",
        action: "research",
        scope: "homepage metadata",
      },
    })
  );
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.approval.status, "pending");
  assert.equal(body.approval.decidedBy, null);
});

test("approve requires a fresh sign-in (step-up)", async () => {
  const { route } = app();
  const created = await (
    await route(
      req("/api/approvals", {
        method: "POST",
        body: {
          request: "Review homepage metadata.",
          workflow: "brand-audit",
          action: "research",
          scope: "homepage metadata",
        },
      })
    )
  ).json();

  const stale = mintJwt(keys, { email: OWNER, iat: Math.floor(Date.now() / 1000) - 3600 });
  const response = await route(
    req(`/api/approvals/${created.approval.id}/approve`, {
      method: "POST",
      body: { note: "ok" },
      jwt: stale,
    })
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "STEP_UP_REQUIRED");
});

test("owner can approve and the audit chain records it", async () => {
  const { route } = app();
  const created = await (
    await route(
      req("/api/approvals", {
        method: "POST",
        body: {
          request: "Review homepage metadata.",
          workflow: "brand-audit",
          action: "research",
          scope: "homepage metadata",
        },
      })
    )
  ).json();

  const approved = await route(
    req(`/api/approvals/${created.approval.id}/approve`, { method: "POST", body: { note: "approved" } })
  );
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).status, "approved");

  const verify = await (await route(req("/api/audit/verify"))).json();
  assert.equal(verify.ok, true);
});

test("approval cannot be decided twice", async () => {
  const { route } = app();
  const created = await (
    await route(
      req("/api/approvals", {
        method: "POST",
        body: {
          request: "Review homepage metadata.",
          workflow: "brand-audit",
          action: "research",
          scope: "homepage metadata",
        },
      })
    )
  ).json();

  await route(req(`/api/approvals/${created.approval.id}/approve`, { method: "POST", body: {} }));
  const second = await route(
    req(`/api/approvals/${created.approval.id}/reject`, { method: "POST", body: {} })
  );
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, "APPROVAL_ALREADY_DECIDED");
});

test("removed side-effect endpoints return 404, not 403", async () => {
  const { route } = app();
  for (const path of ["/api/publish", "/api/send", "/api/charge", "/api/bookings", "/api/deploy"]) {
    const response = await route(req(path, { method: "POST", body: {} }));
    assert.equal(response.status, 404, `${path} must not exist`);
  }
});

test("AI analysis is blocked while Hive is disabled", async () => {
  const { route } = app({ PURPOSE_ENABLE_HIVE: "" });
  let called = false;
  const response = await route(
    req("/api/ai/analyze", {
      method: "POST",
      body: {
        request: "Review homepage metadata.",
        workflow: "brand-audit",
        action: "research",
        scope: "homepage metadata",
      },
    })
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "HIVE_DISABLED");
  assert.equal(called, false);
});

test("AI analysis refuses a write capability before touching the network", async () => {
  const { route } = app({ PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "test-key" });
  const response = await route(
    req("/api/ai/analyze", {
      method: "POST",
      body: {
        request: "Write a newsletter.",
        workflow: "brand-audit",
        action: "publish",
        scope: "newsletter",
        audience: "subscribers",
        channel: "email",
      },
    })
  );
  assert.equal(response.status, 422);
});

test("AI analysis returns a proposal with executed false", async () => {
  const keysPair = keys;
  let received;
  const fakeFetch = async (url, init) => {
    received = { url, init };
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Findings: add a canonical tag." } }],
        usage: { prompt_tokens: 120, completion_tokens: 40 },
      }),
    };
  };

  const db = createMemoryD1();
  const { route } = createLocalApp({
    db,
    env: { ...TEST_ENV, PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "sk-test-key-not-real" },
    jwks: keysPair.jwks,
    fetchImpl: fakeFetch,
  });

  const response = await route(
    req("/api/ai/analyze", {
      method: "POST",
      body: {
        request: "Review homepage metadata.",
        workflow: "brand-audit",
        action: "research",
        scope: "homepage metadata",
      },
    })
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.executed, false);
  assert.ok(body.text.includes("canonical"));
  assert.ok(received.url.endsWith("/chat/completions"));
  assert.equal(received.init.headers.Authorization, "Bearer sk-test-key-not-real");
  assert.ok(!JSON.stringify(body).includes("sk-test-key-not-real"));
});

test("AI request is capped by the governance ceiling", async () => {
  let sent;
  const fakeFetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
    };
  };
  const db = createMemoryD1();
  const { route } = createLocalApp({
    db,
    env: { ...TEST_ENV, PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "k" },
    jwks: keys.jwks,
    fetchImpl: fakeFetch,
  });

  await route(
    req("/api/ai/analyze", {
      method: "POST",
      body: {
        request: "Review homepage metadata.",
        workflow: "brand-audit",
        action: "research",
        scope: "homepage metadata",
        maxOutputTokens: 999999,
      },
    })
  );
  assert.equal(sent.max_tokens, 1200);
});

test("daily request budget blocks further AI calls", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
  });
  const db = createMemoryD1();
  const { route, stores } = createLocalApp({
    db,
    env: { ...TEST_ENV, PURPOSE_ENABLE_HIVE: "1", HIVE_API_KEY: "k" },
    jwks: keys.jwks,
    fetchImpl: fakeFetch,
  });

  for (let i = 0; i < 100; i += 1) {
    await stores.usage.record({ model: "deepseek-ai/deepseek-v4.1-flash-1017", inputTokens: 1, outputTokens: 1, estimate: 0, outcome: "ok", estimatedCostUsd: 0 });
  }

  const response = await route(
    req("/api/ai/analyze", {
      method: "POST",
      body: {
        request: "Review homepage metadata.",
        workflow: "brand-audit",
        action: "research",
        scope: "homepage metadata",
      },
    })
  );
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "DAILY_REQUESTS_EXCEEDED");
});
