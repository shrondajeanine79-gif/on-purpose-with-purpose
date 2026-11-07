import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, "..", "migrations");

/**
 * Minimal D1-compatible adapter over node:sqlite.
 * Production uses the real D1 binding; repositories only rely on the D1 surface:
 *   db.prepare(sql).bind(...).first() / .all() / .run()
 *   db.batch([stmt, ...])
 */
class Prepared {
  constructor(sql, db) {
    this.sql = sql;
    this.db = db;
    this.params = [];
    this.statement = null;
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  #stmt() {
    if (!this.statement) this.statement = this.db.prepare(this.sql);
    return this.statement;
  }

  first(column) {
    const row = this.#stmt().get(...this.params) ?? null;
    if (row === null) return null;
    return column === undefined ? row : row[column];
  }

  all() {
    return { results: this.#stmt().all(...this.params) };
  }

  run() {
    const info = this.#stmt().run(...this.params);
    return {
      success: true,
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }
}

export class LocalD1 {
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON");
  }

  prepare(sql) {
    return new Prepared(sql, this.db);
  }

  async batch(statements) {
    const results = [];
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const statement of statements) results.push(statement.run());
      this.db.exec("COMMIT");
      return results;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  exec(sql) {
    this.db.exec(sql);
  }

  applyMigration(file = join(MIGRATIONS_DIR, "0001_init.sql")) {
    const sql = readFileSync(file, "utf8");
    this.db.exec(sql);
    return sql;
  }

  close() {
    this.db.close();
  }
}

export function createMemoryD1() {
  const db = new LocalD1(":memory:");
  db.applyMigration();
  return db;
}
