import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog, ApprovalStore, GENESIS, hashEntry } from "../src/audit.js";

const createdDirs = [];
after(() => {
  for (const dir of createdDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "purpose-audit-"));
  createdDirs.push(dir);
  return dir;
}

test("audit log starts with a genesis previous hash", () => {
  const dir = tempDir();
  const log = new AuditLog(dir);
  const entry = log.append("cli.run", "owner", { command: "status" });
  assert.equal(entry.seq, 1);
  assert.equal(entry.prevHash, GENESIS);
  assert.equal(entry.type, "cli.run");
});

test("audit log chain verifies and increments sequence", () => {
  const dir = tempDir();
  const log = new AuditLog(dir);
  log.append("cli.run", "owner", { command: "status" });
  log.append("directive.created", "owner", { workflow: "brand-audit" });
  log.append("approval.granted", "owner", { id: "abc" });
  const result = log.verify();
  assert.equal(result.ok, true);
  assert.equal(result.count, 3);
});

test("audit verification detects tampering", () => {
  const dir = tempDir();
  const log = new AuditLog(dir);
  log.append("cli.run", "owner", { command: "status" });
  log.append("approval.granted", "owner", { id: "abc" });

  const file = join(dir, "audit.log.jsonl");
  const lines = readFileSync(file, "utf8").trim().split("\n");
  const tampered = JSON.parse(lines[0]);
  tampered.payload.command = "publish";
  lines[0] = JSON.stringify(tampered);
  writeFileSync(file, `${lines.join("\n")}\n`);

  const result = log.verify();
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.problem === "hash mismatch"));
});

test("hash ignores key order", () => {
  const a = hashEntry({ b: 1, a: 2 });
  const b = hashEntry({ a: 2, b: 1 });
  assert.equal(a, b);
});

test("approvals default to pending and cannot be consumed before approval", () => {
  const dir = tempDir();
  const store = new ApprovalStore(dir);
  const record = store.request({
    action: "draft",
    workflow: "content-draft",
    summary: "Example request",
  });
  assert.equal(record.status, "pending");
  assert.throws(() => store.consume(record.id), /not approved/);
});

test("approval decision is recorded and idempotency is enforced", () => {
  const dir = tempDir();
  const store = new ApprovalStore(dir);
  const record = store.request({ action: "draft", workflow: "content-draft", summary: "x" });
  const approved = store.decide(record.id, "approved", "Looks right");
  assert.equal(approved.status, "approved");
  assert.equal(approved.decidedBy, "owner");
  assert.throws(() => store.decide(record.id, "approved"), /already approved/);
});

test("approved item can be consumed exactly once", () => {
  const dir = tempDir();
  const store = new ApprovalStore(dir);
  const record = store.request({ action: "draft", workflow: "content-draft", summary: "x" });
  store.decide(record.id, "approved");
  const consumed = store.consume(record.id);
  assert.equal(consumed.status, "consumed");
  assert.throws(() => store.consume(record.id), /not approved/);
});

test("rejection is terminal", () => {
  const dir = tempDir();
  const store = new ApprovalStore(dir);
  const record = store.request({ action: "draft", workflow: "content-draft", summary: "x" });
  store.decide(record.id, "rejected", "Not on brand");
  assert.equal(store.get(record.id).status, "rejected");
  assert.throws(() => store.consume(record.id), /not approved/);
});

test("approval records are listed by status", () => {
  const dir = tempDir();
  const store = new ApprovalStore(dir);
  const first = store.request({ action: "draft", workflow: "content-draft", summary: "one" });
  store.request({ action: "draft", workflow: "content-draft", summary: "two" });
  store.decide(first.id, "approved");
  assert.equal(store.list("pending").length, 1);
  assert.equal(store.list("approved").length, 1);
  assert.equal(store.list().length, 2);
});
