import { validateDirective, resolveApprovalRequirement, DirectiveError } from "./directive.js";
import { gapList, requiredGaps, assertContentReady } from "./brand.js";

/**
 * Phase 2 policy surface shared by the Worker and the CLI.
 * Pure functions over config objects; no I/O. Deny by default.
 */

export class PolicyError extends Error {
  constructor(code, message, details = {}, status = 403) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function evaluateDirective(raw, governance) {
  try {
    return { ok: true, directive: validateDirective(raw, governance) };
  } catch (error) {
    if (error instanceof DirectiveError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        details: error.details,
      };
    }
    throw error;
  }
}

export function authorizeCapability(governance, action) {
  const capability = governance.capabilities?.[action];
  if (!capability) {
    throw new PolicyError("UNKNOWN_ACTION", `Capability "${action}" is not defined.`, {}, 404);
  }
  if (!capability.enabled) {
    throw new PolicyError(
      "CAPABILITY_DISABLED",
      `Capability "${action}" is disabled in this phase.`,
      { phase: capability.phase },
      403
    );
  }
  return capability;
}

/**
 * Read-only analysis gate. Mirrors the Phase 1 Hive guard but without any
 * environment or network access, so it can be unit tested deterministically.
 */
export function authorizeAnalysis({
  governance,
  brandStandard,
  action,
  approval,
  workflow,
}) {
  if (!["research", "recommend", "analytics_view"].includes(action)) {
    throw new PolicyError(
      "ANALYSIS_ONLY",
      `Only read-only analysis is available in Phase 2. "${action}" is not permitted.`,
      { allowed: ["research", "recommend", "analytics_view"] }
    );
  }

  authorizeCapability(governance, action);

  const workflowDef = governance.workflows?.[workflow];
  if (!workflowDef) {
    throw new PolicyError("UNKNOWN_WORKFLOW", `Workflow "${workflow}" is not authorized.`);
  }
  if (!workflowDef.enabled) {
    throw new PolicyError("WORKFLOW_DISABLED", `Workflow "${workflow}" is not enabled.`, {
      phase: workflowDef.phase,
    });
  }
  if (!workflowDef.allowedActions?.includes(action)) {
    throw new PolicyError(
      "ACTION_NOT_ALLOWED",
      `Workflow "${workflow}" does not authorize "${action}".`,
      { allowedActions: workflowDef.allowedActions ?? [] }
    );
  }

  if (approval && approval.action !== action) {
    throw new PolicyError(
      "APPROVAL_MISMATCH",
      "The approval does not cover this capability. Approvals are not transferable."
    );
  }

  if (approval && approval.status !== "approved") {
    throw new PolicyError(
      "APPROVAL_NOT_APPROVED",
      `A supplied approval must be approved. It is "${approval.status}".`
    );
  }

  const requirement = resolveApprovalRequirement(governance, action);
  if (requirement.requiresApproval) {
    if (!approval || approval.status !== "approved") {
      throw new PolicyError(
        "APPROVAL_REQUIRED",
        "This capability requires an owner approval record that is currently approved."
      );
    }
  }

  if (workflowDef.requiresBrandStandard) {
    const readiness = assertContentReady(brandStandard);
    if (!readiness.ready) {
      throw new PolicyError(
        "BRAND_STANDARD_INCOMPLETE",
        "Required brand standards are not owner-approved. Ask the owner instead of inventing policy.",
        { gaps: readiness.gaps.map((gap) => gap.key) }
      );
    }
  }

  return { requirement };
}

export function brandGaps(brandStandard) {
  return { all: gapList(brandStandard), required: requiredGaps(brandStandard) };
}

export function brandReadiness(brandStandard) {
  return assertContentReady(brandStandard);
}
