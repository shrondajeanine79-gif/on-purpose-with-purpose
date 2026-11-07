import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..");
export const CONFIG_DIR = join(ROOT, "config");
export const DATA_DIR = process.env.PURPOSE_DATA_DIR || join(ROOT, ".data");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadBrandStandard() {
  return readJson(join(CONFIG_DIR, "brand-standard.json"));
}

export function loadGovernance() {
  return readJson(join(CONFIG_DIR, "governance.json"));
}

export function loadInventory() {
  return {
    products: readJson(join(CONFIG_DIR, "inventory", "products.json")),
    pages: readJson(join(CONFIG_DIR, "inventory", "pages.json")),
    links: readJson(join(CONFIG_DIR, "inventory", "links.json")),
    assets: readJson(join(CONFIG_DIR, "inventory", "assets.json")),
  };
}
