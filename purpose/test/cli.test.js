import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "bin", "purpose.js");

function run(args, env = {}) {
  const result = execFileSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env, PURPOSE_DATA_DIR: dataDir },
  });
  return JSON.parse(result);
}

const dataDir = mkdtempSync(join(tmpdir(), "purpose-cli-"));
after(() => rmSync(dataDir, { recursive: true, force: true }));

test("status reports phase 1, local mode, and no deployment", () => {
  const status = run(["status"]);
  assert.equal(status.project, "PURPOSE");
  assert.equal(status.phase, 1);
  assert.equal(status.mode, "LOCAL DEVELOPMENT");
  assert.equal(status.deployed, false);
});

test("status reports hive disabled without explicit opt-in", () => {
  const status = run(["status"], { PURPOSE_ENABLE_HIVE: "", HIVE_API_KEY: "" });
  assert.equal(status.hive.enabledFlag, false);
});

test("gaps lists only unapproved standards", () => {
  const gaps = run(["gaps"]);
  assert.ok(gaps.open > 0);
  assert.equal(gaps.gaps.every((gap) => gap.status === "NEEDS OWNER REVIEW"), true);
});

test("inventory reports missing logo and favicon", () => {
  const inv = run(["inventory"]);
  assert.ok(inv.missingAssets.includes("logo"));
  assert.ok(inv.missingAssets.includes("favicon"));
});

test("the published placeholder URLs are preserved exactly in review output", () => {
  const review = run(["review"]);
  const raw = JSON.stringify(review);
  assert.ok(raw.includes("https://youtube.com"));
  assert.ok(!raw.includes("youtube.com/@"));
});

test("a read-only directive is accepted", () => {
  const result = run(["intent", "examples/read-only-audit.json"]);
  assert.equal(result.accepted, true);
});

test("a publish directive is rejected at the workflow gate", () => {
  const result = run(["intent", "examples/blocked-publish.json"]);
  assert.equal(result.accepted, false);
  assert.ok(["WORKFLOW_DISABLED", "ACTION_NOT_ALLOWED", "CAPABILITY_DISABLED"].includes(result.code));
});

test("an ambiguous directive requests clarification", () => {
  const result = run(["intent", "examples/ambiguous-scope.json"]);
  assert.equal(result.accepted, false);
  assert.equal(result.code, "CLARIFICATION_REQUIRED");
});

test("request creates a pending approval that is never auto-approved", () => {
  const created = run(["request", "examples/read-only-audit.json"]);
  assert.equal(created.created, true);
  assert.equal(created.approval.status, "pending");
});

test("draft is blocked before any network call when hive is disabled", () => {
  const result = run(["draft", "examples/read-only-audit.json"], {
    PURPOSE_ENABLE_HIVE: "",
  });
  assert.equal(result.executed, false);
  assert.equal(result.code, "HIVE_DISABLED");
});

test("draft stays blocked even with a key when the enable flag is absent", () => {
  const result = run(["draft", "examples/read-only-audit.json"], {
    PURPOSE_ENABLE_HIVE: "",
    HIVE_API_KEY: "fake-key-for-test",
  });
  assert.equal(result.code, "HIVE_DISABLED");
});

test("audit chain verifies after CLI activity", () => {
  const result = run(["audit", "--verify"]);
  assert.equal(result.ok, true);
  assert.ok(result.count > 0);
});
