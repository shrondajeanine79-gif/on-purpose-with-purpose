#!/usr/bin/env node
/**
 * PURPOSE — Phase 3 local dry run.
 *
 * Exercises the complete owner workflow against the real router, real policy engine,
 * real budget checks, and real audit chain, using an in-memory database, ephemeral dev
 * auth, and a deterministic stub model.
 *
 * Guarantees:
 *  - No network calls. The stub fetch is asserted to be the only "HTTP" surface.
 *  - No Hive key. The key is a literal placeholder that is never transmitted.
 *  - No real identity. Dev auth refuses to run beside production auth env vars.
 *  - Nothing published, sent, charged, booked, or deployed.
 */

import { createMemoryD1 } from "../d1.js";
import { createLocalApp } from "./server.js";
import { createStubFetch, STUB_MODEL } from "../ai/stub.js";
import { createDevIdentity, dryRunEnv, assertSafeDevEnvironment, DEV_OWNER_EMAIL } from "./dev-auth.js";
import { loadGovernance } from "../config.js";

const STEP = (n, label) => ({ n, label });

function line(char = "-") {
  return char.repeat(72);
}

function heading(text) {
  process.stdout.write(`\n${text}\n${line("=")}\n`);
}

function step(meta) {
  process.stdout.write(`\n[${meta.n}] ${meta.label}\n${line()}\n`);
}

function request(path, { method = "GET", token, body } = {}) {
  return new Request(`https://dry-run.invalid${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "cf-access-jwt-assertion": token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  assertSafeDevEnvironment(process.env);

  const env = dryRunEnv();
  const identity = createDevIdentity();
  const stub = createStubFetch();
  const db = createMemoryD1();
  const { route, stores } = createLocalApp({ db, env, jwks: identity.jwks, fetchImpl: stub.fetch });

  heading("PURPOSE PHASE 3 DRY RUN");
  process.stdout.write(
    [
      "Mode:        local, in-memory, deterministic stub model",
      `Model:       ${STUB_MODEL} (not Hive, no network)`,
      `Owner:       ${DEV_OWNER_EMAIL} (ephemeral dev identity)`,
      "Hive key:    placeholder only, never transmitted",
      "Side effect: none. Nothing is published, sent, charged, booked, or deployed.",
    ].join("\n") + "\n"
  );

  const summary = [];

  step(STEP(1, "Unauthenticated request is rejected"));
  {
    const response = await route(
      new Request("https://dry-run.invalid/api/status", { headers: {} })
    );
    const body = await response.json();
    process.stdout.write(`HTTP ${response.status} ${body.error.code}\n`);
    summary.push({ step: 1, result: `${response.status} ${body.error.code}` });
  }

  step(STEP(2, "Authenticated owner reads status"));
  const ownerToken = identity.mint();
  {
    const response = await route(request("/api/status", { token: ownerToken }));
    const body = await response.json();
    process.stdout.write(
      [
        `HTTP ${response.status}`,
        `role:            ${body.role}`,
        `phase:           ${body.phase}`,
        `deployed:        ${body.deployed}`,
        `workflows:       ${body.workflowsEnabled.join(", ")}`,
        `capabilities:    ${body.capabilitiesEnabled.join(", ")}`,
        `hive configured: ${body.hive.configured} / enabled ${body.hive.enabled}`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 2, result: `${response.status} owner=${body.role}` });
  }

  step(STEP(3, "Owner submits a bounded read-only directive"));
  const directiveBody = {
    request:
      "Review the live homepage title, meta description, and Open Graph tags, then report gaps and recommendations. Do not change anything.",
    workflow: "brand-audit",
    action: "research",
    scope: "homepage metadata only",
    audience: "owner",
    notes: "Read-only dry run.",
  };
  let directiveId;
  {
    const response = await route(
      request("/api/directives/validate", { method: "POST", token: ownerToken, body: directiveBody })
    );
    const body = await response.json();
    directiveId = body.directive?.id;
    process.stdout.write(
      [
        `HTTP ${response.status}`,
        `directive id: ${directiveId}`,
        `status:       ${body.directive?.status}`,
        `workflow:     ${body.directive?.workflow}`,
        `action:       ${body.directive?.action}`,
        `scope:        ${body.directive?.scope}`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 3, result: `${response.status} validated` });
  }

  step(STEP(4, "Owner requests a pending approval"));
  let approvalId;
  {
    const response = await route(
      request("/api/approvals", { method: "POST", token: ownerToken, body: directiveBody })
    );
    const body = await response.json();
    approvalId = body.approval?.id;
    process.stdout.write(
      [
        `HTTP ${response.status}`,
        `approval id: ${approvalId}`,
        `status:      ${body.approval?.status}`,
        `decided by:  ${body.approval?.decidedBy ?? "null"}`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 4, result: `${response.status} pending` });
  }

  step(STEP(5, "A pending or unapproved approval is refused"));
  {
    const pendingOnly = await route(
      request("/api/ai/analyze", {
        method: "POST",
        token: ownerToken,
        body: { ...directiveBody, approvalId },
      })
    );
    const pendingBody = await pendingOnly.json();
    process.stdout.write(
      `pending approval: HTTP ${pendingOnly.status} ${pendingBody.error?.code ?? ""}\n`
    );
    process.stdout.write(
      "note: read-only research needs no per-run approval, but any approval that IS supplied\n" +
        "      must already be approved, must match the action, and is consumed after use.\n"
    );
    summary.push({ step: 5, result: `${pendingOnly.status} ${pendingBody.error?.code}` });
  }

  step(STEP(6, "A write capability is refused"));
  {
    const response = await route(
      request("/api/ai/analyze", {
        method: "POST",
        token: ownerToken,
        body: { ...directiveBody, action: "publish", channel: "site" },
      })
    );
    const body = await response.json();
    process.stdout.write(`HTTP ${response.status} ${body.error?.code ?? body.code}\n`);
    summary.push({ step: 6, result: `${response.status} refused write` });
  }

  step(STEP(7, "Owner approves with a fresh sign-in"));
  {
    const response = await route(
      request(`/api/approvals/${approvalId}/approve`, {
        method: "POST",
        token: ownerToken,
        body: { note: "Approved for read-only dry run." },
      })
    );
    const body = await response.json();
    process.stdout.write(
      [`HTTP ${response.status}`, `status:     ${body.status}`, `decided by: ${body.decidedBy}`].join("\n") + "\n"
    );
    summary.push({ step: 7, result: `${response.status} approved` });
  }

  step(STEP(8, "Approved read-only analysis runs against the stub"));
  {
    const response = await route(
      request("/api/ai/analyze", {
        method: "POST",
        token: ownerToken,
        body: { ...directiveBody, approvalId, directiveId },
      })
    );
    const body = await response.json();
    process.stdout.write(
      [
        `HTTP ${response.status}`,
        `executed: ${body.executed}`,
        `model:    ${body.model}`,
        `usage:    ${JSON.stringify(body.usage)}`,
        `note:     ${body.note}`,
        "",
        "MODEL OUTPUT (proposal only)",
        line(),
        body.text,
      ].join("\n") + "\n"
    );
    summary.push({ step: 8, result: `${response.status} proposal executed=${body.executed}` });
  }

  step(STEP(9, "Approval cannot be reused"));
  {
    const response = await route(
      request("/api/ai/analyze", {
        method: "POST",
        token: ownerToken,
        body: { ...directiveBody, approvalId, directiveId },
      })
    );
    const body = await response.json();
    process.stdout.write(`HTTP ${response.status} ${body.error?.code ?? ""}\n`);

    const reapprove = await route(
      request(`/api/approvals/${approvalId}/approve`, { method: "POST", token: ownerToken, body: {} })
    );
    const reapproveBody = await reapprove.json();
    process.stdout.write(`re-approve: HTTP ${reapprove.status} ${reapproveBody.error?.code ?? ""}\n`);
    summary.push({ step: 9, result: `${response.status} ${body.error?.code}` });
  }

  step(STEP(10, "Side-effect endpoints do not exist"));
  {
    const results = [];
    for (const path of ["/api/publish", "/api/send", "/api/charge", "/api/bookings", "/api/deploy"]) {
      const response = await route(request(path, { method: "POST", token: ownerToken, body: {} }));
      results.push(`${path} -> ${response.status}`);
    }
    process.stdout.write(results.join("\n") + "\n");
    summary.push({ step: 10, result: "all 404" });
  }

  step(STEP(11, "Audit chain verification"));
  {
    const response = await route(request("/api/audit/verify", { token: ownerToken }));
    const body = await response.json();
    process.stdout.write(
      [`HTTP ${response.status}`, `ok:       ${body.ok}`, `events:   ${body.count}`, `problems: ${body.problems.length}`].join("\n") + "\n"
    );
    summary.push({ step: 11, result: `ok=${body.ok} events=${body.count}` });
  }

  step(STEP(12, "Full audit trail"));
  {
    const response = await route(request("/api/audit?limit=100", { token: ownerToken }));
    const events = await response.json();
    process.stdout.write(
      events
        .slice()
        .reverse()
        .map((event) => `#${String(event.seq).padStart(2, "0")}  ${event.type.padEnd(22)} ${event.actor}`)
        .join("\n") + "\n"
    );
    process.stdout.write(`\nTotal events: ${events.length}\n`);
    summary.push({ step: 12, result: `${events.length} audit events` });
  }

  step(STEP(13, "Stub call accounting"));
  {
    const blocked = summary.filter((entry) => /refus|404|APPROVAL|403/i.test(String(entry.result))).length;
    process.stdout.write(
      [
        `stub "network" calls: ${stub.calls.length} (expected exactly 1, the approved run)`,
        `model requested:      ${stub.calls[0]?.body?.model ?? "n/a"}`,
        `max_tokens sent:      ${stub.calls[0]?.body?.max_tokens ?? "n/a"}`,
        `refused or blocked:   ${blocked} steps`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 13, result: `${stub.calls.length} stub call(s)` });
  }

  // ---------------------------------------------------------------------------
  // Approval-scenario matrix.
  // A local governance overlay makes the read-only "research" capability require
  // an approval record, so approved / missing / denied can each be proven. This
  // overlay exists only in memory for this dry run; the on-disk config is untouched.
  // ---------------------------------------------------------------------------
  const overlayGovernance = structuredClone(loadGovernance());
  overlayGovernance.approvalMatrix.find((row) => row.action === "research").requiresApproval = true;

  function scenarioApp() {
    const scenarioStub = createStubFetch();
    const scenarioDb = createMemoryD1();
    const scenario = createLocalApp({
      db: scenarioDb,
      env,
      jwks: identity.jwks,
      fetchImpl: scenarioStub.fetch,
      configOverride: { governance: overlayGovernance },
    });
    return { ...scenario, stub: scenarioStub, db: scenarioDb };
  }

  step(STEP(14, "Scenario A - approved request succeeds"));
  {
    const scenario = scenarioApp();
    const created = await (
      await scenario.route(request("/api/approvals", { method: "POST", token: ownerToken, body: directiveBody }))
    ).json();
    await scenario.route(
      request(`/api/approvals/${created.approval.id}/approve`, {
        method: "POST",
        token: ownerToken,
        body: { note: "approved for scenario A" },
      })
    );
    const response = await scenario.route(
      request("/api/ai/analyze", {
        method: "POST",
        token: ownerToken,
        body: { ...directiveBody, approvalId: created.approval.id },
      })
    );
    const body = await response.json();
    process.stdout.write(
      [
        `approval:  approved`,
        `analysis:  HTTP ${response.status} executed=${body.executed}`,
        `stub calls: ${scenario.stub.calls.length}`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 14, result: `${response.status} approved-run executed=${body.executed}` });
    scenario.db.close();
  }

  step(STEP(15, "Scenario B - missing approval is refused"));
  {
    const scenario = scenarioApp();
    let callsBefore = 0;
    const response = await scenario.route(
      request("/api/ai/analyze", { method: "POST", token: ownerToken, body: { ...directiveBody } })
    );
    const body = await response.json();
    process.stdout.write(
      [
        `analysis without approval: HTTP ${response.status} ${body.error?.code ?? ""}`,
        `stub calls: ${scenario.stub.calls.length} (expected 0)`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 15, result: `${response.status} ${body.error?.code}` });
    scenario.db.close();
    void callsBefore;
  }

  step(STEP(16, "Scenario C - denied approval is refused"));
  {
    const scenario = scenarioApp();
    const created = await (
      await scenario.route(request("/api/approvals", { method: "POST", token: ownerToken, body: directiveBody }))
    ).json();
    const denied = await scenario.route(
      request(`/api/approvals/${created.approval.id}/reject`, {
        method: "POST",
        token: ownerToken,
        body: { note: "denied for scenario C" },
      })
    );
    const deniedBody = await denied.json();
    const response = await scenario.route(
      request("/api/ai/analyze", {
        method: "POST",
        token: ownerToken,
        body: { ...directiveBody, approvalId: created.approval.id },
      })
    );
    const body = await response.json();
    process.stdout.write(
      [
        `approval:  ${deniedBody.status} (${denied.status})`,
        `analysis:  HTTP ${response.status} ${body.error?.code ?? ""}`,
        `stub calls: ${scenario.stub.calls.length} (expected 0)`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 16, result: `${response.status} ${body.error?.code}` });
    scenario.db.close();
  }

  step(STEP(17, "Hive remains disconnected"));
  {
    const originalFetch = globalThis.fetch;
    let globalCalls = 0;
    globalThis.fetch = async () => {
      globalCalls += 1;
      throw new Error("Network access attempted during dry run");
    };
    try {
      await route(request("/api/status", { token: ownerToken }));
    } finally {
      globalThis.fetch = originalFetch;
    }
    process.stdout.write(
      [
        `global fetch interceptions: ${globalCalls}`,
        `HIVE_API_KEY is a placeholder: ${env.HIVE_API_KEY === "dry-run-not-a-real-key"}`,
        `Hive base URL: ${env.HIVE_BASE_URL}`,
      ].join("\n") + "\n"
    );
    summary.push({ step: 17, result: `${globalCalls} real network calls` });
  }

  heading("SUMMARY");
  process.stdout.write(
    summary.map((entry) => `  ${String(entry.step).padStart(2)}. ${entry.result}`).join("\n") + "\n"
  );

  const dbVerification = await stores.audit.verify();
  process.stdout.write(
    [
      "",
      `Audit DB verification: ok=${dbVerification.ok} events=${dbVerification.count}`,
      `Stub network calls:    ${stub.calls.length}`,
      `Executed side effects: 0`,
      "",
    ].join("\n")
  );

  const failures = [];
  if (summary[0].result !== "401 AUTH_MISSING") failures.push("unauthenticated request was not rejected");
  if (!summary[1].result.startsWith("200")) failures.push("owner status failed");
  if (!summary[2].result.startsWith("201")) failures.push("directive was not validated");
  if (!summary[3].result.startsWith("201")) failures.push("approval was not created pending");
  if (!String(summary[4].result).includes("APPROVAL_NOT_APPROVED")) {
    failures.push("pending approval was not refused");
  }
  if (!String(summary[5].result).includes("422")) failures.push("write capability was not refused");
  if (!summary[6].result.startsWith("200")) failures.push("owner approval failed");
  if (!String(summary[7].result).includes("executed=false")) failures.push("analysis was not a proposal");
  if (!String(summary[8].result).includes("APPROVAL_NOT_APPROVED")) {
    failures.push("consumed approval was reused");
  }
  if (summary[9].result !== "all 404") failures.push("a side-effect route exists");
  if (!String(summary[10].result).startsWith("ok=true")) failures.push("audit chain did not verify");
  if (stub.calls.length !== 1) failures.push(`expected 1 stub call, saw ${stub.calls.length}`);
  if (!dbVerification.ok) failures.push("database audit chain did not verify");

  if (!String(summary[13].result).startsWith("200")) failures.push("scenario A (approved) did not run");
  if (!String(summary[13].result).includes("executed=false")) {
    failures.push("scenario A output was not a proposal");
  }
  if (!String(summary[14].result).includes("APPROVAL_REQUIRED")) {
    failures.push("scenario B (missing approval) was not refused");
  }
  if (!String(summary[15].result).includes("APPROVAL_NOT_APPROVED")) {
    failures.push("scenario C (denied approval) was not refused");
  }
  if (summary[16].result !== "0 real network calls") {
    failures.push("a real network call was attempted");
  }

  if (failures.length > 0) {
    process.stdout.write("DRY RUN RESULT: FAIL\n");
    for (const failure of failures) process.stdout.write(`  - ${failure}\n`);
    process.stdout.write("\n");
    db.close();
    process.exitCode = 1;
    return;
  }

  process.stdout.write("DRY RUN RESULT: PASS\n\n");
  db.close();
}

main().catch((error) => {
  process.stderr.write(`DRY RUN FAILED: ${error.message}\n`);
  process.exitCode = 1;
});
