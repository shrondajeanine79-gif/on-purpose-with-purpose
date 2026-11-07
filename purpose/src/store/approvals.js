import { randomUUID } from "node:crypto";

const SELECT = "SELECT * FROM approvals";

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    directiveId: row.directive_id,
    action: row.action,
    workflow: row.workflow,
    summary: row.summary,
    artifact: row.artifact ? JSON.parse(row.artifact) : null,
    status: row.status,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    consumedAt: row.consumed_at,
  };
}

export class ApprovalRepository {
  constructor(db) {
    this.db = db;
  }

  async create({ directiveId = null, action, workflow, summary, artifact = null, requestedBy = "owner" }) {
    if (!action || !workflow || !summary) {
      throw new Error("action, workflow, and summary are required");
    }
    const record = {
      id: randomUUID(),
      directive_id: directiveId,
      action,
      workflow,
      summary,
      artifact: artifact ? JSON.stringify(artifact) : null,
      status: "pending",
      requested_by: requestedBy,
      created_at: new Date().toISOString(),
    };
    await this.db
      .prepare(
        `INSERT INTO approvals
           (id, directive_id, action, workflow, summary, artifact, status, requested_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        record.id,
        record.directive_id,
        record.action,
        record.workflow,
        record.summary,
        record.artifact,
        record.status,
        record.requested_by,
        record.created_at
      )
      .run();
    return this.get(record.id);
  }

  async get(id) {
    return hydrate(await this.db.prepare(`${SELECT} WHERE id = ?`).bind(id).first());
  }

  async list(status) {
    const stmt = status
      ? this.db.prepare(`${SELECT} WHERE status = ? ORDER BY created_at DESC`).bind(status)
      : this.db.prepare(`${SELECT} ORDER BY created_at DESC`);
    return (await stmt.all()).results.map(hydrate);
  }

  async decide(id, decision, { note = "", decidedBy = "owner" } = {}) {
    if (decision !== "approved" && decision !== "rejected") {
      throw new Error('decision must be "approved" or "rejected"');
    }
    const current = await this.get(id);
    if (!current) throw new Error(`approval ${id} not found`);
    if (current.status !== "pending") throw new Error(`approval ${id} is already ${current.status}`);

    await this.db
      .prepare(
        `UPDATE approvals
            SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
          WHERE id = ? AND status = 'pending'`
      )
      .bind(decision, decidedBy, new Date().toISOString(), note || null, id)
      .run();
    return this.get(id);
  }

  async consume(id) {
    const current = await this.get(id);
    if (!current) throw new Error(`approval ${id} not found`);
    if (current.status !== "approved") throw new Error(`approval ${id} is not approved`);

    await this.db
      .prepare(
        `UPDATE approvals SET status = 'consumed', consumed_at = ?
          WHERE id = ? AND status = 'approved'`
      )
      .bind(new Date().toISOString(), id)
      .run();
    return this.get(id);
  }
}
