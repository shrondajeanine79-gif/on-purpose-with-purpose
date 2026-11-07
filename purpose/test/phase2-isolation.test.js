import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".data" || name === ".git") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

test("no Data Scout references exist anywhere in PURPOSE", () => {
  const self = fileURLToPath(import.meta.url);
  const hits = [];
  for (const file of walk(root)) {
    if (file === self) continue;
    if (![".js", ".json", ".md", ".sql", ".txt", ".example"].includes(extname(file))) continue;
    const text = readFileSync(file, "utf8").toLowerCase();
    if (text.includes("data scout") || text.includes("datascout") || text.includes("data_scout")) {
      hits.push(file);
    }
  }
  assert.deepEqual(hits, [], `Data Scout references found: ${hits.join(", ")}`);
});

test("no shared-purpose identifiers leak across the boundary", () => {
  const files = walk(root).filter((f) => extname(f) === ".js");
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.ok(!/require\(["'].*scout/.test(text), `unexpected scout import in ${file}`);
  }
});

test("PURPOSE source contains no hardcoded secrets", () => {
  const files = walk(root).filter((f) => [".js", ".json", ".sql"].includes(extname(f)));
  const offenders = [];
  for (const file of files) {
    if (file.includes("\\test\\") || file.includes("/test/")) continue;
    const text = readFileSync(file, "utf8");
    if (/sk-[A-Za-z0-9]{20,}/.test(text)) offenders.push(file);
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("Phase 2 source never calls a publish, send, charge, or deploy API", () => {
  const files = walk(root).filter((f) => extname(f) === ".js" && !f.includes("test"));
  const forbidden = [
    /fetch\([^)]*api\.stripe\.com/i,
    /api\.mailerlite\.com/i,
    /api\.cal\.com/i,
    /api\.github\.com[^)]*pulls[^)]*POST/i,
    /method:\s*["']PUT["']/,
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(text), `${file} matches forbidden pattern ${pattern}`);
    }
  }
});

test("no route string implements a side effect", () => {
  const router = readFileSync(join(root, "src", "api", "router.js"), "utf8");
  const pathLiterals = [...router.matchAll(/path === "([^"]+)"/g)].map((m) => m[1]);
  for (const literal of pathLiterals) {
    assert.ok(
      !/publish|send|charge|booking|deploy|merge/i.test(literal),
      `side-effect route present: ${literal}`
    );
  }
});

test("migration is forward-only and declares append-only triggers", () => {
  const sql = readFileSync(join(root, "migrations", "0001_init.sql"), "utf8");
  assert.ok(sql.includes("audit_events_no_update"));
  assert.ok(sql.includes("audit_events_no_delete"));
  assert.ok(sql.includes("schema_migrations"));
  assert.ok(!/DROP TABLE/i.test(sql));
});

test("Hive key is only read from the environment", () => {
  const files = walk(root).filter((f) => extname(f) === ".js" && !f.includes("test"));
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const literalAssignments = text.match(/HIVE_API_KEY\s*=\s*["'][^"']+["']/g);
    assert.equal(literalAssignments, null, `hardcoded key assignment in ${file}`);
  }
});
