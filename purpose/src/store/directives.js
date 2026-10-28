import { randomUUID } from "node:crypto";

export class DirectiveRepository {
  constructor(db) {
    this.db = db;
  }

  async create({
    workflow,
    action,
    request,
    scope = null,
    audience = null,
    channel = null,
    notes = null,
    actor = "owner",
    status = "validated",
    code = null,
    details = null,
  }) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO directives
           (id, workflow, action, request, scope, audience, channel, notes, actor, status, code, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        workflow,
        action,
        request,
        scope,
        audience,
        channel,
        notes,
        actor,
        status,
        code,
        details ? JSON.stringify(details) : null,
        createdAt
      )
      .run();
    return this.get(id);
  }

  async get(id) {
    const row = await this.db.prepare("SELECT * FROM directives WHERE id = ?").bind(id).first();
    if (!row) return null;
    return {
      id: row.id,
      workflow: row.workflow,
      action: row.action,
      request: row.request,
      scope: row.scope,
      audience: row.audience,
      channel: row.channel,
      notes: row.notes,
      actor: row.actor,
      status: row.status,
      code: row.code,
      details: row.details ? JSON.parse(row.details) : null,
      createdAt: row.created_at,
    };
  }

  async list(limit = 50) {
    const result = await this.db
      .prepare("SELECT * FROM directives ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all();
    return result.results.map((row) => ({
      id: row.id,
      workflow: row.workflow,
      action: row.action,
      request: row.request,
      status: row.status,
      code: row.code,
      createdAt: row.created_at,
    }));
  }
}

export class UsageRepository {
  constructor(db) {
    this.db = db;
  }

  async record({
    model,
    inputTokens = null,
    outputTokens = null,
    estimatedCostUsd = null,
    directiveId = null,
    outcome,
    reason = null,
  }) {
    const id = randomUUID();
    await this.db
      .prepare(
        `INSERT INTO usage_ledger
           (id, at, model, input_tokens, output_tokens, estimated_cost_usd, directive_id, outcome, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        new Date().toISOString(),
        model,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        directiveId,
        outcome,
        reason
      )
      .run();
    return id;
  }

  async totals(sinceIso) {
    const row = await this.db
      .prepare(
        `SELECT
           COALESCE(SUM(input_tokens), 0)  AS input_tokens,
           COALESCE(SUM(output_tokens), 0) AS output_tokens,
           COALESCE(SUM(estimated_cost_usd), 0) AS cost_usd,
           COUNT(*) AS requests
         FROM usage_ledger
        WHERE at >= ? AND outcome = 'ok'`
      )
      .bind(sinceIso)
      .first();
    return {
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      costUsd: Number(row.cost_usd),
      requests: Number(row.requests),
    };
  }
}
