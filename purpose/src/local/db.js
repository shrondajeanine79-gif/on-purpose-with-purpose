import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../config.js";
import { LocalD1 } from "../d1.js";

export function localDbPath() {
  return process.env.PURPOSE_DB_PATH || join(DATA_DIR, "purpose.db");
}

export function openLocalDb({ create = false } = {}) {
  const path = localDbPath();
  if (!create && !existsSync(path)) {
    return { db: null, path, exists: false };
  }
  if (create && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new LocalD1(path);
  return { db, path, exists: true };
}

export function migrateLocalDb() {
  const { db, path } = openLocalDb({ create: true });
  db.applyMigration();
  const applied = db
    .prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version")
    .all().results;
  return { path, applied };
}
