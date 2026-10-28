import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryD1 } from "../src/d1.js";
import { AuditChain } from "../src/store/audit-chain.js";
import { GENESIS } from "../src/hash.js";

function fresh() {
  const db = createMemoryD1();
  return { db, chain: new AuditChain(db) };
}

test("D1 schema applies cleanly", () => {
  const db = createMemoryD1();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .results.map((row) => row.name);
  for (const table of [
    "approvals",
    "audit_events",
    "config_versions",
    "directives",
    "schema_migrations",
    "usage_ledger",
  ]) {
    assert.ok(tables.includes(table), `missing table ${table}`);
  }
});

test("audit chain starts at genesis and increments", async () => {
  const { chain } = fresh();
  const first = await chain.append({ type: "cli.run", actor: "owner", payload: { a: 1 } });
  const second = await chain.append({ type: "cli.run", actor: "owner", payload: { a: 2 } });
  assert.equal(first.prevHash, GENESIS);
  assert.equal(first.seq, 1);
  assert.equal(second.prevHash, first.hash);
  assert.equal(second.seq, 2);
});

test("audit chain verifies", async () => {
  const { chain } = fresh();
  await chain.append({ type: "directive.created", actor: "owner", payload: {} });
  await chain.append({ type: "hive.requested", actor: "owner", payload: {} });
  const result = await chain.verify();
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
});

test("audit table rejects UPDATE", async () => {
  const { db, chain } = fresh();
  await chain.append({ type: "cli.run", actor: "owner", payload: {} });
  assert.throws(
    () => db.prepare("UPDATE audit_events SET type='publish' WHERE seq=1").run(),
    /append-only/
  );
});

test("audit table rejects DELETE", async () => {
  const { db, chain } = fresh();
  await chain.append({ type: "cli.run", actor: "owner", payload: {} });
  assert.throws(() => db.prepare("DELETE FROM audit_events WHERE seq=1").run(), /append-only/);
});

test("querying audit list returns newest first with parsed payload", async () => {
  const { chain } = fresh();
  await chain.append({ type: "a", actor: "owner", payload: { n: 1 } });
  await chain.append({ type: "b", actor: "owner", payload: { n: 2 } });
  const rows = await chain.list(10);
  assert.equal(rows[0].type, "b");
  assert.deepEqual(rows[0].payload, { n: 2 });
});

test("foreign keys are enforced", () => {
  const db = createMemoryD1();
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO approvals (id, directive_id, action, workflow, summary, status, requested_by, created_at)
           VALUES ('a1', 'missing-directive', 'research', 'brand-audit', 'x', 'pending', 'owner', 'now')`
        )
        .run(),
    /FOREIGN KEY/
  );
});

test("approval status is constrained by CHECK", () => {
  const db = createMemoryD1();
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO approvals (id, action, workflow, summary, status, requested_by, created_at)
           VALUES ('a2', 'research', 'brand-audit', 'x', 'auto-approved', 'owner', 'now')`
        )
        .run(),
    /CHECK/
  );
});
