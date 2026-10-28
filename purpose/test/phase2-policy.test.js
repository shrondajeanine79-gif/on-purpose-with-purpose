import test from "node:test";
import assert from "node:assert/strict";
import { authorizeAnalysis, authorizeCapability, evaluateDirective, PolicyError, brandGaps } from "../src/policy.js";
import { loadBrandStandard, loadGovernance } from "../src/config.js";

const gov = loadGovernance();
const brand = loadBrandStandard();

const baseArgs = {
  governance: gov,
  brandStandard: brand,
  action: "research",
  approval: null,
  workflow: "brand-audit",
};

test("authorizeAnalysis permits read-only research", () => {
  assert.doesNotThrow(() => authorizeAnalysis(baseArgs));
});

test("authorizeAnalysis permits recommend and analytics_view", () => {
  assert.doesNotThrow(() => authorizeAnalysis({ ...baseArgs, action: "recommend" }));
  assert.doesNotThrow(() => authorizeAnalysis({ ...baseArgs, action: "analytics_view" }));
});

test("authorizeAnalysis refuses every write capability", () => {
  for (const action of ["draft", "edit", "publish", "send", "charge", "booking_change", "schedule"]) {
    assert.throws(
      () => authorizeAnalysis({ ...baseArgs, action }),
      (error) => error instanceof PolicyError && error.code === "ANALYSIS_ONLY"
    );
  }
});

test("authorizeAnalysis refuses a disabled workflow", () => {
  assert.throws(
    () => authorizeAnalysis({ ...baseArgs, workflow: "revenue-audit" }),
    (error) => error.code === "WORKFLOW_DISABLED"
  );
});

test("authorizeAnalysis refuses an unknown workflow", () => {
  assert.throws(
    () => authorizeAnalysis({ ...baseArgs, workflow: "freeform" }),
    (error) => error.code === "UNKNOWN_WORKFLOW"
  );
});

test("authorizeAnalysis refuses an action outside the workflow", () => {
  assert.throws(
    () => authorizeAnalysis({ ...baseArgs, workflow: "inventory-review", action: "analytics_view" }),
    (error) => error.code === "ACTION_NOT_ALLOWED"
  );
});

test("approval for a different action is not transferable", () => {
  assert.throws(
    () => authorizeAnalysis({ ...baseArgs, approval: { status: "approved", action: "publish" } }),
    (error) => error.code === "APPROVAL_MISMATCH"
  );
});

test("a capability requiring approval is denied without one", () => {
  const customGov = structuredClone(gov);
  customGov.approvalMatrix.find((row) => row.action === "research").requiresApproval = true;
  assert.throws(
    () => authorizeAnalysis({ ...baseArgs, governance: customGov }),
    (error) => error.code === "APPROVAL_REQUIRED"
  );
  assert.doesNotThrow(() =>
    authorizeAnalysis({
      ...baseArgs,
      governance: customGov,
      approval: { status: "approved", action: "research" },
    })
  );
});

test("a workflow requiring brand standards is blocked while gaps remain", () => {
  const customGov = structuredClone(gov);
  customGov.workflows["brand-audit"].requiresBrandStandard = true;
  assert.throws(
    () => authorizeAnalysis({ ...baseArgs, governance: customGov }),
    (error) => error.code === "BRAND_STANDARD_INCOMPLETE" && error.details.gaps.length > 0
  );
});

test("brand readiness flips only when required fields are approved", () => {
  const approvedBrand = structuredClone(brand);
  for (const key of approvedBrand.requiredForContent) {
    approvedBrand.fields[key].approved = true;
    approvedBrand.fields[key].status = "APPROVED";
  }
  const customGov = structuredClone(gov);
  customGov.workflows["brand-audit"].requiresBrandStandard = true;
  assert.doesNotThrow(() =>
    authorizeAnalysis({ ...baseArgs, governance: customGov, brandStandard: approvedBrand })
  );
  assert.equal(brandGaps(brand).required.length, brand.requiredForContent.length);
});

test("authorizeCapability returns 404 for unknown and 403 for disabled", () => {
  assert.throws(
    () => authorizeCapability(gov, "self_publish"),
    (error) => error.status === 404 && error.code === "UNKNOWN_ACTION"
  );
  assert.throws(
    () => authorizeCapability(gov, "publish"),
    (error) => error.status === 403 && error.code === "CAPABILITY_DISABLED"
  );
});

test("evaluateDirective returns a denial object instead of throwing", () => {
  const result = evaluateDirective({}, gov);
  assert.equal(result.ok, false);
  assert.equal(result.code, "CLARIFICATION_REQUIRED");
});

test("evaluateDirective accepts a valid directive", () => {
  const result = evaluateDirective(
    { request: "audit metadata", workflow: "brand-audit", action: "research", scope: "homepage" },
    gov
  );
  assert.equal(result.ok, true);
  assert.equal(result.directive.workflow, "brand-audit");
});

test("audit_view is enabled in governance", () => {
  assert.equal(gov.capabilities.audit_view.enabled, true);
});
