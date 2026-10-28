import { sha256Hex, canonicalize } from "../hash.js";

/**
 * Versioned config. Every change creates a new immutable row; nothing is overwritten.
 * If no row exists yet, the file-based config is seeded with approved_by = null so it is
 * clearly not owner-approved.
 */

function stableHash(obj) {
  return sha256Hex(canonicalize(obj));
}

export class ConfigStore {
  constructor(db) {
    this.db = db;
  }

  async latest(kind) {
    const row = await this.db
      .prepare(
        `SELECT id, kind, version, body, body_sha256, approved_by, approved_at, created_at
           FROM config_versions WHERE kind = ? ORDER BY version DESC LIMIT 1`
      )
      .bind(kind)
      .first();
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind,
      version: Number(row.version),
      body: JSON.parse(row.body),
      bodySha256: row.body_sha256,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
    };
  }

  async put({ kind, body, approvedBy = null }) {
    if (kind !== "brand_standard" && kind !== "governance") {
      throw new Error(`Unsupported config kind: ${kind}`);
    }
    const latest = await this.latest(kind);
    const version = latest ? latest.version + 1 : 1;
    const id = `${kind}-v${version}`;
    const serialized = JSON.stringify(body);
    const digest = stableHash(body);
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO config_versions
           (id, kind, version, body, body_sha256, approved_by, approved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, kind, version, serialized, digest, approvedBy, approvedBy ? now : null, now)
      .run();

    return this.latest(kind);
  }

  async ensureSeeded({ brandStandard, governance }) {
    const currentBrand = await this.latest("brand_standard");
    const currentGovernance = await this.latest("governance");
    const created = [];
    if (!currentBrand) {
      await this.put({ kind: "brand_standard", body: brandStandard });
      created.push("brand_standard");
    }
    if (!currentGovernance) {
      await this.put({ kind: "governance", body: governance });
      created.push("governance");
    }
    return created;
  }

  async active() {
    const [brand, governance] = await Promise.all([
      this.latest("brand_standard"),
      this.latest("governance"),
    ]);
    if (!brand || !governance) {
      throw new Error("Config has not been seeded. Run ensureSeeded() first.");
    }
    return { brandStandard: brand.body, governance: governance.body, versions: {
      brandStandard: brand.version,
      governance: governance.version,
    }, approval: {
      brandStandardApproved: Boolean(brand.approvedBy),
      governanceApproved: Boolean(governance.approvedBy),
    } };
  }
}
