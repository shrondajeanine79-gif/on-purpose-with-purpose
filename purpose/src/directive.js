const CAPABILITY_KEYS = [
  "research",
  "recommend",
  "draft",
  "edit",
  "schedule",
  "send",
  "publish",
  "analytics_view",
  "inventory_view",
  "booking_change",
  "charge",
  "config_edit",
];

export class DirectiveError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DirectiveError";
    this.code = code;
    this.details = details;
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateDirective(raw, governance) {
  const input = raw ?? {};
  const issues = [];
  const missing = [];

  const request = clean(input.request);
  const workflowId = clean(input.workflow);
  const action = clean(input.action);

  if (!request) missing.push("request");
  if (!workflowId) missing.push("workflow");
  if (!action) missing.push("action");

  if (missing.length) {
    throw new DirectiveError(
      "CLARIFICATION_REQUIRED",
      "The directive is incomplete. PURPOSE will not guess missing requirements.",
      { missing, question: "What exactly should PURPOSE do, under which authorized workflow, and for which capability?" }
    );
  }

  if (!CAPABILITY_KEYS.includes(action)) {
    throw new DirectiveError(
      "UNKNOWN_ACTION",
      `Action "${action}" is not a recognized capability.`,
      { allowed: CAPABILITY_KEYS }
    );
  }

  const workflow = governance.workflows?.[workflowId];
  if (!workflow) {
    throw new DirectiveError(
      "UNKNOWN_WORKFLOW",
      `Workflow "${workflowId}" is not authorized. PURPOSE cannot invent workflows.`,
      { authorized: Object.keys(governance.workflows ?? {}) }
    );
  }

  if (!workflow.enabled) {
    throw new DirectiveError(
      "WORKFLOW_DISABLED",
      `Workflow "${workflowId}" exists but is not enabled in this phase.`,
      { phase: workflow.phase, enabled: false }
    );
  }

  if (!Array.isArray(workflow.allowedActions) || !workflow.allowedActions.includes(action)) {
    throw new DirectiveError(
      "ACTION_NOT_ALLOWED",
      `Workflow "${workflowId}" does not authorize the "${action}" capability.`,
      { allowedActions: workflow.allowedActions ?? [] }
    );
  }

  const capability = governance.capabilities?.[action];
  if (!capability) {
    throw new DirectiveError("UNKNOWN_ACTION", `Capability "${action}" is not defined.`);
  }
  if (!capability.enabled) {
    throw new DirectiveError(
      "CAPABILITY_DISABLED",
      `Capability "${action}" is not enabled in this phase.`,
      { phase: capability.phase }
    );
  }
  if (capability.channelRequired && !clean(input.channel)) {
    throw new DirectiveError(
      "CLARIFICATION_REQUIRED",
      `Capability "${action}" requires an approved channel, and none was supplied.`,
      { missing: ["channel"], question: "Which approved channel should this target?" }
    );
  }
  if (capability.ownerOnly && input.actor !== "owner") {
    throw new DirectiveError(
      "OWNER_ONLY",
      `Capability "${action}" is restricted to the owner.`
    );
  }

  const scope = clean(input.scope);
  const audience = clean(input.audience);
  if (capability.enabled && (action === "draft" || action === "publish" || action === "send")) {
    if (!scope) missing.push("scope");
    if (!audience) missing.push("audience");
  }

  if (issues.length === 0 && (scope === "" && (action === "research" || action === "recommend"))) {
    issues.push({
      field: "scope",
      message: "A read-only task still needs a bounded scope. PURPOSE will not roam.",
    });
  }

  if (missing.length) {
    throw new DirectiveError(
      "CLARIFICATION_REQUIRED",
      "Required directive fields are missing. PURPOSE will not invent them.",
      { missing, question: "Please supply the missing fields so the task stays within approved scope." }
    );
  }

  if (issues.length) {
    throw new DirectiveError("CLARIFICATION_REQUIRED", "The directive needs owner clarification.", {
      issues,
    });
  }

  return {
    request,
    workflow: workflowId,
    action,
    scope: scope || null,
    audience: audience || null,
    channel: clean(input.channel) || null,
    notes: clean(input.notes) || null,
    actor: clean(input.actor) || "owner",
    createdAt: new Date().toISOString(),
  };
}

export function resolveApprovalRequirement(governance, action) {
  const row = (governance.approvalMatrix ?? []).find((entry) => entry.action === action);
  if (!row) return { requiresApproval: true, requiresReauth: true, enabled: false, unknown: true };
  return row;
}

export { CAPABILITY_KEYS };
