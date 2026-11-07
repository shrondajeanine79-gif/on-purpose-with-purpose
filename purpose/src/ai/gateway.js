import { authorizeAnalysis, PolicyError } from "../policy.js";
import { checkBudget, estimateCostUsd, startOfUtcDay, startOfUtcMonth, BudgetError } from "../budget.js";
import { buildOwnerInstruction, hiveStatus, HiveBlockedError } from "../hive.js";

/**
 * Phase 2 Hive gateway. Unlike the Phase 1 adapter, this one:
 *  - never reads the key from anything except the server env/secret binding
 *  - requires an authorization decision (policy) before any network call
 *  - requires a budget check before any network call
 *  - records usage and returns a proposal (executed: false)
 */
export async function runAnalysis({
  directive,
  approval = null,
  governance,
  brandStandard,
  stores,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  requestedOutputTokens,
  actor = "owner",
}) {
  const status = hiveStatus(env);
  if (!status.enabledFlag) {
    throw new HiveBlockedError(
      "HIVE_DISABLED",
      "Hive is disabled. Set PURPOSE_ENABLE_HIVE=1 only after the owner approves a specific run."
    );
  }
  if (!status.hasApiKey) {
    throw new HiveBlockedError("HIVE_NO_KEY", "HIVE_API_KEY is not configured on the server.");
  }

  authorizeAnalysis({
    governance,
    brandStandard,
    action: directive.action,
    approval,
    workflow: directive.workflow,
  });

  const ceiling = Number(governance.hive?.maxOutputTokens ?? 1200);
  const maxTokens = Math.min(Number(requestedOutputTokens ?? ceiling), ceiling);

  const today = await stores.usage.totals(startOfUtcDay(now));
  const month = await stores.usage.totals(startOfUtcMonth(now));
  checkBudget({ today, month, requestedOutputTokens: maxTokens });

  const response = await fetchImpl(`${status.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.HIVE_API_KEY}`,
    },
    body: JSON.stringify({
      model: status.model,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Owner-directed read-only analyst for On Purpose With Purpose. No tools. No publishing, sending, charging, booking, or deployment. If information is missing, say what the owner must supply.",
        },
        { role: "user", content: buildOwnerInstruction(directive) },
      ],
    }),
  });

  if (!response.ok) {
    await stores.usage.record({
      model: status.model,
      directiveId: directive.id ?? null,
      outcome: "error",
      reason: `http_${response.status}`,
    });
    throw new HiveBlockedError("HIVE_HTTP_ERROR", `Hive returned HTTP ${response.status}.`, {
      status: response.status,
    });
  }

  const data = await response.json();
  const inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(data?.usage?.completion_tokens ?? 0);
  const estimatedCostUsd = estimateCostUsd({
    model: status.model,
    inputTokens,
    outputTokens,
    cachedInputTokens: Number(data?.usage?.prompt_tokens_details?.cached_tokens ?? 0),
  });

  await stores.usage.record({
    model: status.model,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    directiveId: directive.id ?? null,
    outcome: "ok",
  });

  if (approval?.id) {
    await stores.approvals.consume(approval.id);
  }

  await stores.audit.append({
    type: "hive.requested",
    actor,
    payload: {
      directiveId: directive.id ?? null,
      approvalId: approval?.id ?? null,
      workflow: directive.workflow,
      action: directive.action,
      model: status.model,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    },
  });

  return {
    executed: false,
    model: status.model,
    text: data?.choices?.[0]?.message?.content ?? null,
    usage: { inputTokens, outputTokens, estimatedCostUsd },
    note: "Proposal only. Nothing was published, sent, charged, booked, or deployed.",
  };
}

export function classifyAiError(error) {
  if (error instanceof PolicyError) {
    return { status: error.status, code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof BudgetError) {
    return { status: 429, code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof HiveBlockedError) {
    const status = error.code === "HIVE_DISABLED" ? 503 : 502;
    return { status, code: error.code, message: error.message, details: error.details };
  }
  return null;
}
