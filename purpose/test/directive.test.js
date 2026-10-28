import test from "node:test";
import assert from "node:assert/strict";
import { validateDirective, DirectiveError, resolveApprovalRequirement } from "../src/directive.js";
import { loadGovernance } from "../src/config.js";

const gov = loadGovernance();

test("rejects an empty directive and asks for clarification", () => {
  assert.throws(
    () => validateDirective({}, gov),
    (error) => error instanceof DirectiveError && error.code === "CLARIFICATION_REQUIRED"
  );
});

test("rejects an unknown workflow instead of inventing one", () => {
  assert.throws(
    () =>
      validateDirective(
        { request: "write a blog post", workflow: "invented-workflow", action: "draft" },
        gov
      ),
    (error) => error.code === "UNKNOWN_WORKFLOW"
  );
});

test("rejects an unknown capability", () => {
  assert.throws(
    () =>
      validateDirective(
        { request: "post to social", workflow: "brand-audit", action: "auto_post" },
        gov
      ),
    (error) => error.code === "UNKNOWN_ACTION"
  );
});

test("refuses draft capability because it is disabled in Phase 1", () => {
  assert.throws(
    () =>
      validateDirective(
        { request: "draft a newsletter", workflow: "content-draft", action: "draft" },
        gov
      ),
    (error) =>
      error.code === "WORKFLOW_DISABLED" ||
      error.code === "ACTION_NOT_ALLOWED" ||
      error.code === "CAPABILITY_DISABLED"
  );
});

test("refuses publish even inside an enabled workflow", () => {
  assert.throws(
    () =>
      validateDirective(
        { request: "update the homepage", workflow: "brand-audit", action: "publish" },
        gov
      ),
    (error) => error.code === "ACTION_NOT_ALLOWED"
  );
});

test("requires a channel for capabilities that demand one", () => {
  const customGov = structuredClone(gov);
  customGov.capabilities.draft.enabled = true;
  customGov.workflows["content-draft"].enabled = true;
  assert.throws(
    () =>
      validateDirective(
        {
          request: "draft an announcement",
          workflow: "content-draft",
          action: "draft",
          scope: "announcement",
          audience: "subscribers",
        },
        customGov
      ),
    (error) => error.code === "CLARIFICATION_REQUIRED" && error.details.missing.includes("channel")
  );
});

test("accepts a bounded read-only audit directive", () => {
  const directive = validateDirective(
    {
      request: "Review the live homepage SEO metadata and report findings.",
      workflow: "brand-audit",
      action: "research",
      scope: "homepage metadata only",
    },
    gov
  );
  assert.equal(directive.workflow, "brand-audit");
  assert.equal(directive.action, "research");
  assert.equal(directive.actor, "owner");
});

test("approval matrix denies unknown actions by default", () => {
  const row = resolveApprovalRequirement(gov, "delete_everything");
  assert.equal(row.requiresApproval, true);
  assert.equal(row.enabled, false);
  assert.equal(row.unknown, true);
});

test("capabilities are independent: approving research does not approve publish", () => {
  assert.equal(resolveApprovalRequirement(gov, "research").requiresApproval, false);
  assert.equal(resolveApprovalRequirement(gov, "publish").requiresApproval, true);
  assert.equal(resolveApprovalRequirement(gov, "publish").enabled, false);
});

test("config_edit is owner-only", () => {
  assert.throws(
    () =>
      validateDirective(
        { request: "change brand voice", workflow: "brand-audit", action: "config_edit", actor: "visitor" },
        gov
      ),
    (error) => error.code === "OWNER_ONLY" || error.code === "ACTION_NOT_ALLOWED"
  );
});
