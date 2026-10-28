import test from "node:test";
import assert from "node:assert/strict";
import { loadBrandStandard, loadGovernance, loadInventory } from "../src/config.js";
import { gapList, requiredGaps, assertContentReady, summarizeGaps } from "../src/brand.js";
import { inventorySummary, inventoryReview } from "../src/inventory.js";

const brand = loadBrandStandard();
const gov = loadGovernance();
const inv = loadInventory();

test("brand standard starts unapproved and never claims approval", () => {
  const approved = Object.values(brand.fields).filter((field) => field.approved === true);
  assert.equal(approved.length, 0);
});

test("every brand field carries an explicit status", () => {
  for (const [key, field] of Object.entries(brand.fields)) {
    assert.ok(field.status, `${key} is missing a status`);
    assert.ok(field.note, `${key} is missing an owner note`);
  }
});

test("observed values are never treated as approved policy", () => {
  for (const [key, field] of Object.entries(brand.fields)) {
    if (field.value !== null) {
      assert.equal(field.approved, false, `${key} has an observed value but reads as approved`);
      assert.equal(field.status, "NEEDS OWNER REVIEW", `${key} observed value must still need review`);
    }
  }
});

test("all required content standards are currently open", () => {
  const gaps = requiredGaps(brand);
  assert.deepEqual(
    gaps.map((gap) => gap.key).sort(),
    [...brand.requiredForContent].sort()
  );
});

test("content readiness is false until the owner approves required standards", () => {
  const readiness = assertContentReady(brand);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reason.includes("must not create content"));
});

test("approving all required fields flips readiness without mutating the on-disk config", () => {
  const copy = structuredClone(brand);
  for (const key of copy.requiredForContent) {
    copy.fields[key].approved = true;
    copy.fields[key].status = "APPROVED";
  }
  assert.equal(assertContentReady(copy).ready, true);
  assert.equal(assertContentReady(brand).ready, false);
});

test("gap summary counts match the registry", () => {
  const summary = summarizeGaps();
  assert.equal(summary.total, Object.keys(brand.fields).length);
  assert.equal(summary.open, gapList(brand).length);
  assert.ok(summary.open > 0);
});

test("governance enables no write capabilities in Phase 1", () => {
  const writeActions = ["publish", "send", "charge", "booking_change", "schedule", "draft", "edit"];
  for (const action of writeActions) {
    assert.equal(gov.capabilities[action].enabled, false, `${action} must be disabled`);
  }
});

test("all integrations are inactive except read-only github", () => {
  for (const [name, integration] of Object.entries(gov.integrations)) {
    if (name === "github") {
      assert.equal(integration.status, "READ ONLY");
      continue;
    }
    assert.notEqual(integration.status, "ACTIVE", `${name} must not be active`);
  }
});

test("public chatbot is deferred", () => {
  assert.equal(gov.integrations.publicChatbot.status, "DEFERRED");
  assert.equal(gov.workflows["public-chatbot"].enabled, false);
});

test("hive is disabled by default in governance", () => {
  assert.equal(gov.hive.enabledByDefault, false);
  assert.equal(gov.hive.env.apiKey, "HIVE_API_KEY");
});

test("inventory records products, pages, links, and assets without prices invented", () => {
  assert.ok(inv.products.products.length >= 5);
  assert.ok(inv.pages.pages.length >= 10);
  assert.ok(inv.links.linksInBio.entries.length >= 9);
  assert.ok(inv.assets.assets.length >= 8);
  for (const product of inv.products.products) {
    if (product.price !== null) {
      assert.equal(product.reviewStatus, "NEEDS OWNER REVIEW");
    }
  }
});

test("inventory summary reports missing assets and open reviews", () => {
  const summary = inventorySummary();
  assert.ok(summary.openReviews > 0);
  assert.ok(summary.missingAssets.includes("logo"));
  assert.ok(summary.missingAssets.includes("favicon"));
  assert.ok(summary.revenueNotActive.length > 0);
});

test("inventory review flags bare-domain links and does not invent replacements", () => {
  const findings = inventoryReview();
  const linkFindings = findings.filter((finding) => finding.area === "links");
  assert.ok(linkFindings.length > 0);
  for (const finding of linkFindings) {
    assert.ok(finding.action.includes("will not guess"));
  }
});

test("no inventoried URL was rewritten from a guess", () => {
  const published = inv.links.linksInBio.entries.map((entry) => entry.url);
  assert.ok(published.includes("https://youtube.com"));
  assert.ok(published.includes("https://facebook.comsubscribe/"));
  assert.ok(published.includes("mailto:shronda779@gmail.com"));
});

test("revenue streams are all inactive or link-only", () => {
  for (const stream of inv.assets.revenueStreams) {
    assert.ok(["NOT ACTIVE", "LINK ONLY", "NOT CONFIGURED"].includes(stream.status));
  }
});
