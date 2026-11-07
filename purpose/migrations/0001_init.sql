-- PURPOSE Phase 2 schema (D1-compatible SQLite)
-- Forward-only migration. Never edit after it has been applied.
-- No secrets, no customer data, no payment data.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_versions (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('brand_standard', 'governance')),
  version     INTEGER NOT NULL,
  body        TEXT NOT NULL,
  body_sha256 TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (kind, version)
);

CREATE INDEX IF NOT EXISTS idx_config_versions_kind_version
  ON config_versions (kind, version DESC);

CREATE TABLE IF NOT EXISTS directives (
  id         TEXT PRIMARY KEY,
  workflow   TEXT NOT NULL,
  action     TEXT NOT NULL,
  request    TEXT NOT NULL,
  scope      TEXT,
  audience   TEXT,
  channel    TEXT,
  notes      TEXT,
  actor      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('validated', 'clarification', 'denied')),
  code       TEXT,
  details    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_directives_created
  ON directives (created_at DESC);

CREATE TABLE IF NOT EXISTS approvals (
  id            TEXT PRIMARY KEY,
  directive_id  TEXT,
  action        TEXT NOT NULL,
  workflow      TEXT NOT NULL,
  summary       TEXT NOT NULL,
  artifact      TEXT,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'consumed')),
  requested_by  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  decided_by    TEXT,
  decided_at    TEXT,
  decision_note TEXT,
  consumed_at   TEXT,
  FOREIGN KEY (directive_id) REFERENCES directives(id)
);

CREATE INDEX IF NOT EXISTS idx_approvals_status
  ON approvals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  seq        INTEGER PRIMARY KEY,
  at         TEXT NOT NULL,
  type       TEXT NOT NULL,
  actor      TEXT NOT NULL,
  payload    TEXT NOT NULL,
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TABLE IF NOT EXISTS usage_ledger (
  id                 TEXT PRIMARY KEY,
  at                 TEXT NOT NULL,
  model              TEXT NOT NULL,
  input_tokens       INTEGER,
  output_tokens      INTEGER,
  estimated_cost_usd REAL,
  directive_id       TEXT,
  outcome            TEXT NOT NULL CHECK (outcome IN ('ok', 'blocked', 'error')),
  reason             TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_at
  ON usage_ledger (at DESC);

INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (1, '2026-10-26T00:00:00.000Z');
