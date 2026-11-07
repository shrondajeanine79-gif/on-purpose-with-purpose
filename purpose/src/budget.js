/**
 * Budgets and rate limits for Hive usage.
 * Deny by default: if a limit cannot be evaluated, the request is blocked.
 */

export class BudgetError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "BudgetError";
    this.code = code;
    this.details = details;
  }
}

export const PRICING = Object.freeze({
  "deepseek-ai/deepseek-v4.1-flash-1017": {
    inputPerMillion: 0.1,
    outputPerMillion: 0.35,
    cachedInputPerMillion: 0.003,
  },
});

export function estimateCostUsd({ model, inputTokens = 0, outputTokens = 0, cachedInputTokens = 0 }) {
  const price = PRICING[model];
  if (!price) return null;
  const fresh = Math.max(0, inputTokens - cachedInputTokens);
  return (
    (fresh / 1_000_000) * price.inputPerMillion +
    (cachedInputTokens / 1_000_000) * price.cachedInputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  );
}

export const DEFAULT_BUDGET = Object.freeze({
  dailyRequests: 100,
  dailyTokens: 250_000,
  monthlyCostUsd: 5,
  maxOutputTokens: 1200,
});

export function startOfUtcDay(nowMs = Date.now()) {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export function startOfUtcMonth(nowMs = Date.now()) {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/**
 * @param {object} args
 * @param {{requests:number,inputTokens:number,outputTokens:number,costUsd:number}} args.today
 * @param {{costUsd:number}} args.month
 * @param {number} args.requestedOutputTokens
 */
export function checkBudget({ today, month, requestedOutputTokens, budget = DEFAULT_BUDGET }) {
  if (!today || !month) {
    throw new BudgetError("BUDGET_UNKNOWN", "Usage could not be read. Refusing to spend.");
  }
  if (requestedOutputTokens > budget.maxOutputTokens) {
    throw new BudgetError(
      "OUTPUT_TOO_LARGE",
      `Requested output (${requestedOutputTokens}) exceeds the ceiling (${budget.maxOutputTokens}).`,
      { ceiling: budget.maxOutputTokens }
    );
  }
  if (today.requests >= budget.dailyRequests) {
    throw new BudgetError("DAILY_REQUESTS_EXCEEDED", "Daily request budget reached.", {
      limit: budget.dailyRequests,
      used: today.requests,
    });
  }
  const tokensUsed = today.inputTokens + today.outputTokens;
  if (tokensUsed >= budget.dailyTokens) {
    throw new BudgetError("DAILY_TOKENS_EXCEEDED", "Daily token budget reached.", {
      limit: budget.dailyTokens,
      used: tokensUsed,
    });
  }
  if (month.costUsd >= budget.monthlyCostUsd) {
    throw new BudgetError("MONTHLY_COST_EXCEEDED", "Monthly spend budget reached.", {
      limit: budget.monthlyCostUsd,
      used: month.costUsd,
    });
  }
  return { ok: true };
}
