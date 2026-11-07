import { GENESIS, hashEntry } from "../hash.js";

/**
 * D1-backed append-only audit chain.
 * Writes are single-row inserts; reads verify the chain. The DB triggers block
 * UPDATE and DELETE, so tampering fails at the storage layer as well as in verify().
 */

export class AuditChain {
  constructor(db) {
    this.db = db;
  }

  async last() {
    return this.db
      .prepare("SELECT seq, hash FROM audit_events ORDER BY seq DESC LIMIT 1")
      .first();
  }

  async append({ type, actor, payload = {}, at }) {
    const previous = await this.last();
    const prevHash = previous ? previous.hash : GENESIS;
    const seq = (previous ? Number(previous.seq) : 0) + 1;
    const body = {
      seq,
      at: at ?? new Date().toISOString(),
      type,
      actor: actor ?? "owner",
      payload,
      prevHash,
    };
    const hash = hashEntry(body);
    await this.db
      .prepare(
        `INSERT INTO audit_events (seq, at, type, actor, payload, prev_hash, hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(seq, body.at, body.type, body.actor, JSON.stringify(body.payload), prevHash, hash)
      .run();
    return { ...body, hash };
  }

  async list(limit = 100) {
    const result = await this.db
      .prepare("SELECT * FROM audit_events ORDER BY seq DESC LIMIT ?")
      .bind(limit)
      .all();
    return result.results.map((row) => ({
      seq: Number(row.seq),
      at: row.at,
      type: row.type,
      actor: row.actor,
      payload: JSON.parse(row.payload),
      prevHash: row.prev_hash,
      hash: row.hash,
    }));
  }

  async verify() {
    const result = await this.db
      .prepare("SELECT * FROM audit_events ORDER BY seq ASC")
      .all();
    const problems = [];
    let expectedPrev = GENESIS;
    let expectedSeq = 1;

    for (const row of result.results) {
      const body = {
        seq: Number(row.seq),
        at: row.at,
        type: row.type,
        actor: row.actor,
        payload: JSON.parse(row.payload),
        prevHash: row.prev_hash,
      };
      if (body.seq !== expectedSeq) {
        problems.push({ seq: body.seq, problem: "sequence gap", expected: expectedSeq });
      }
      if (body.prevHash !== expectedPrev) {
        problems.push({ seq: body.seq, problem: "prevHash mismatch" });
      }
      if (hashEntry(body) !== row.hash) {
        problems.push({ seq: body.seq, problem: "hash mismatch" });
      }
      expectedPrev = row.hash;
      expectedSeq = body.seq + 1;
    }

    return {
      ok: problems.length === 0,
      count: result.results.length,
      lastSeq: expectedSeq - 1,
      lastHash: expectedPrev,
      problems,
    };
  }
}
