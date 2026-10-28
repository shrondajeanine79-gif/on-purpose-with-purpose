import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";

const GENESIS = "0".repeat(64);

export function auditPaths(baseDir = DATA_DIR) {
  return {
    dir: baseDir,
    logFile: join(baseDir, "audit.log.jsonl"),
    stateFile: join(baseDir, "approvals.json"),
  };
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
}

function hashEntry(entry) {
  return createHash("sha256").update(canonicalize(entry)).digest("hex");
}

export class AuditLog {
  constructor(baseDir = DATA_DIR) {
    const paths = auditPaths(baseDir);
    this.dir = paths.dir;
    this.logFile = paths.logFile;
    this.stateFile = paths.stateFile;
    ensureDir(this.dir);
  }

  readEntries() {
    if (!existsSync(this.logFile)) return [];
    return readFileSync(this.logFile, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line));
  }

  lastHash() {
    const entries = this.readEntries();
    if (entries.length === 0) return GENESIS;
    return entries[entries.length - 1].hash;
  }

  append(type, actor, payload = {}) {
    const prevHash = this.lastHash();
    const body = {
      seq: this.readEntries().length + 1,
      at: new Date().toISOString(),
      type,
      actor: actor || "owner",
      payload,
      prevHash,
    };
    const entry = { ...body, hash: hashEntry(body) };
    appendFileSync(this.logFile, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }

  verify() {
    const entries = this.readEntries();
    const problems = [];
    let prevHash = GENESIS;
    entries.forEach((entry, index) => {
      const { hash, ...body } = entry;
      if (body.prevHash !== prevHash) {
        problems.push({ seq: body.seq ?? index + 1, problem: "prevHash mismatch" });
      }
      if (hashEntry(body) !== hash) {
        problems.push({ seq: body.seq ?? index + 1, problem: "hash mismatch" });
      }
      prevHash = hash;
    });
    return { ok: problems.length === 0, count: entries.length, problems };
  }
}

export class ApprovalStore {
  constructor(baseDir = DATA_DIR) {
    const paths = auditPaths(baseDir);
    this.stateFile = paths.stateFile;
    ensureDir(paths.dir);
    if (!existsSync(this.stateFile)) {
      writeFileSync(this.stateFile, JSON.stringify({ schemaVersion: 1, approvals: [] }, null, 2));
    }
  }

  read() {
    return JSON.parse(readFileSync(this.stateFile, "utf8"));
  }

  write(state) {
    writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  request({ action, workflow, summary, artifact = null, requestedBy = "owner" }) {
    const state = this.read();
    const record = {
      id: randomUUID(),
      action,
      workflow,
      summary,
      artifact,
      requestedBy,
      status: "pending",
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      decisionNote: null,
    };
    state.approvals.push(record);
    this.write(state);
    return record;
  }

  decide(id, decision, note = "") {
    if (decision !== "approved" && decision !== "rejected") {
      throw new Error('decision must be "approved" or "rejected"');
    }
    const state = this.read();
    const record = state.approvals.find((item) => item.id === id);
    if (!record) throw new Error(`approval ${id} not found`);
    if (record.status !== "pending") throw new Error(`approval ${id} is already ${record.status}`);
    record.status = decision;
    record.decidedAt = new Date().toISOString();
    record.decidedBy = "owner";
    record.decisionNote = note || null;
    this.write(state);
    return record;
  }

  list(status) {
    const state = this.read();
    if (!status) return state.approvals;
    return state.approvals.filter((item) => item.status === status);
  }

  get(id) {
    return this.read().approvals.find((item) => item.id === id) ?? null;
  }

  consume(id) {
    const state = this.read();
    const record = state.approvals.find((item) => item.id === id);
    if (!record) throw new Error(`approval ${id} not found`);
    if (record.status !== "approved") throw new Error(`approval ${id} is not approved`);
    record.status = "consumed";
    record.consumedAt = new Date().toISOString();
    this.write(state);
    return record;
  }
}

export { GENESIS, canonicalize, hashEntry };
