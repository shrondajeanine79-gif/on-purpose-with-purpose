import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryD1 } from "../src/d1.js";
import { ConfigStore } from "../src/store/config.js";
import { ApprovalRepository } from "../src/store/approvals.js";
import { DirectiveRepository, UsageRepository } from "../src/store/directives.js";
import { loadBrandStandard, loadGovernance } from "../src/config.js";

function store() {
  const db = createMemoryD1();
  return { db, config: new ConfigStore(db), approvals: new ApprovalRepository(db) };
}

test("config seeds unapproved and increments versions", async () => {
  const { config } = store();
  const created = await config.ensureSeeded({
    brandStandard: loadBrandStandard(),
    governance: loadGovernance(),
  });
  assert.deepEqual(created.sort(), ["brand_standard", "governance"]);

  const active = await config.active();
  assert.equal(active.versions.brandStandard, 1);
  assert.equal(active.approval.brandStandardApproved, false);

  await config.put({ kind: "brand_standard", body: loadBrandStandard(), approvedBy: "owner@example.com" });
  const after = await config.active();
  assert.equal(after.versions.brandStandard, 2);
  assert.equal(after.approval.brandStandardApproved, true);
});

test("seeding is idempotent", async () => {
  const { config } = store();
  const input = { brandStandard: loadBrandStandard(), governance: loadGovernance() };
  await config.ensureSeeded(input);
  const second = await config.ensureSeeded(input);
  assert.deepEqual(second, []);
});

test("config versions are immutable history", async () => {
  const { db, config } = store();
  await config.put({ kind: "governance", body: loadGovernance() });
  await config.put({ kind: "governance", body: { ...loadGovernance(), phase: 2 } });
  const rows = await db.prepare("SELECT version, body FROM config_versions WHERE kind='governance' ORDER BY version").all();
  assert.equal(rows.results.length, 2);
  assert.equal(JSON.parse(rows.results[0].body).phase, 1);
  assert.equal(JSON.parse(rows.results[1].body).phase, 2);
});

test("approvals require a valid decision value", async () => {
  const { approvals } = store();
  const record = await approvals.create({ action: "research", workflow: "brand-audit", summary: "x" });
  await assert.rejects(() => approvals.decide(record.id, "auto"), /approved.*rejected/);
});

test("consumption requires prior approval and is single use", async () => {
  const { approvals } = store();
  const record = await approvals.create({ action: "research", workflow: "brand-audit", summary: "x" });
  await assert.rejects(() => approvals.consume(record.id), /not approved/);
  await approvals.decide(record.id, "approved");
  const consumed = await approvals.consume(record.id);
  assert.equal(consumed.status, "consumed");
  await assert.rejects(() => approvals.consume(record.id), /not approved/);
});

test("directives persist status and details", async () => {
  const { db } = store();
  const directives = new DirectiveRepository(db);
  const saved = await directives.create({
    workflow: "brand-audit",
    action: "research",
    request: "audit",
    status: "clarification",
    code: "CLARIFICATION_REQUIRED",
    details: { missing: ["scope"] },
  });
  assert.equal(saved.status, "clarification");
  assert.deepEqual(saved.details, { missing: ["scope"] });
});

test("usage totals only count successful runs", async () => {
  const { db } = store();
  const usage = new UsageRepository(db);
  await usage.record({ model: "deepseek-ai/deepseek-v4.1-flash-1017", inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001, outcome: "ok" });
  await usage.record({ model: "deepseek-ai/deepseek-v4.1-flash-1017", inputTokens: 999, outputTokens: 999, estimatedCostUsd: 9, outcome: "error" });
  const totals = await usage.totals("2000-01-01T00:00:00.000Z");
  assert.equal(totals.requests, 1);
  assert.equal(totals.inputTokens, 100);
});
