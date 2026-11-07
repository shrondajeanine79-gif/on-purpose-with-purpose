import { assertContentReady } from "./brand.js";
import { resolveApprovalRequirement } from "./directive.js";

export const HIVE_DEFAULT_BASE_URL = "https://api-cdn.thehive.ai/api/v3";
export const HIVE_DEFAULT_MODEL = "deepseek-ai/deepseek-v4.1-flash-1017";

export class HiveBlockedError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HiveBlockedError";
    this.code = code;
    this.details = details;
  }
}

export function hiveStatus(env = process.env) {
  return {
    enabledFlag: env.PURPOSE_ENABLE_HIVE === "1",
    hasApiKey: Boolean(env.HIVE_API_KEY && env.HIVE_API_KEY.trim() !== ""),
    baseUrl: env.HIVE_BASE_URL || HIVE_DEFAULT_BASE_URL,
    model: env.HIVE_MODEL || HIVE_DEFAULT_MODEL,
  };
}

export function guardHiveRequest({ directive, governance, brandStandard, approval, env = process.env }) {
  const status = hiveStatus(env);

  if (!status.enabledFlag) {
    throw new HiveBlockedError(
      "HIVE_DISABLED",
      "Hive is disabled. Set PURPOSE_ENABLE_HIVE=1 only after the owner approves a specific run."
    );
  }
  if (!status.hasApiKey) {
    throw new HiveBlockedError(
      "HIVE_NO_KEY",
      "HIVE_API_KEY is missing from the server environment. Keys are never read from the browser or repository."
    );
  }
  if (!directive || !directive.workflow) {
    throw new HiveBlockedError(
      "HIVE_NO_DIRECTIVE",
      "A validated owner directive is required. PURPOSE does not generate content on its own."
    );
  }
  if (!["research", "recommend", "analytics_view"].includes(directive.action)) {
    throw new HiveBlockedError(
      "HIVE_ACTION_BLOCKED",
      `The "${directive.action}" capability is not enabled for Hive calls in Phase 1.`,
      { allowed: ["research", "recommend", "analytics_view"] }
    );
  }

  const requirement = resolveApprovalRequirement(governance, directive.action);

  if (approval && approval.action !== directive.action) {
    throw new HiveBlockedError(
      "HIVE_APPROVAL_MISMATCH",
      "The approval does not cover this capability. Approvals are not transferable."
    );
  }

  if (requirement.requiresApproval) {
    if (!approval || approval.status !== "approved") {
      throw new HiveBlockedError(
        "HIVE_APPROVAL_REQUIRED",
        "This capability requires an owner approval record that is currently approved."
      );
    }
  }

  const workflow = governance.workflows?.[directive.workflow];
  if (!workflow?.requiresBrandStandard) {
    return { ok: true, status, requirement };
  }

  const readiness = assertContentReady(brandStandard);
  if (!readiness.ready) {
    throw new HiveBlockedError(
      "HIVE_BRAND_STANDARD_INCOMPLETE",
      "Required brand standards are not owner-approved. PURPOSE must ask the owner instead of inventing policy.",
      { gaps: readiness.gaps.map((gap) => gap.key) }
    );
  }
  return { ok: true, status, requirement };
}

export function buildOwnerInstruction(directive) {
  return [
    "You are assisting the owner of On Purpose With Purpose.",
    "You are not an autonomous content creator. Follow only the directive below.",
    "If any requirement is missing or ambiguous, stop and state what the owner must clarify.",
    "Do not invent brand policy, prices, dates, claims, URLs, or quotes.",
    "",
    `Workflow: ${directive.workflow}`,
    `Capability: ${directive.action}`,
    `Scope: ${directive.scope ?? "not supplied"}`,
    `Audience: ${directive.audience ?? "not supplied"}`,
    `Channel: ${directive.channel ?? "not supplied"}`,
    `Owner request: ${directive.request}`,
    directive.notes ? `Owner notes: ${directive.notes}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export async function callHive({
  directive,
  governance,
  brandStandard,
  approval,
  env = process.env,
  fetchImpl = globalThis.fetch,
  maxOutputTokens,
}) {
  const guard = guardHiveRequest({ directive, governance, brandStandard, approval, env });

  if (typeof fetchImpl !== "function") {
    throw new HiveBlockedError("HIVE_NO_FETCH", "No fetch implementation is available.");
  }

  const limit = Math.min(
    Number(maxOutputTokens ?? governance.hive?.maxOutputTokens ?? 1200),
    Number(governance.hive?.maxOutputTokens ?? 1200)
  );

  const response = await fetchImpl(`${guard.status.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.HIVE_API_KEY}`,
    },
    body: JSON.stringify({
      model: guard.status.model,
      max_tokens: limit,
      messages: [
        { role: "system", content: "Owner-directed assistant. No autonomous content. No publishing." },
        { role: "user", content: buildOwnerInstruction(directive) },
      ],
    }),
  });

  if (!response.ok) {
    throw new HiveBlockedError("HIVE_HTTP_ERROR", `Hive returned HTTP ${response.status}.`, {
      status: response.status,
    });
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content ?? null;
  return {
    text,
    model: guard.status.model,
    usage: data?.usage ?? null,
    executed: false,
    note: "Output is a proposal only. Nothing was published, sent, charged, or deployed.",
  };
}
