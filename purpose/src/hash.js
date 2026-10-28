import { createHash } from "node:crypto";

/**
 * Canonical JSON and hash-chain rules shared with the Phase 1 file audit log.
 * The algorithm must stay identical so `audit --verify` works across both stores.
 */

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
}

export function sha256Hex(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function hashEntry(body) {
  return sha256Hex(canonicalize(body));
}

export const GENESIS = "0".repeat(64);
