import test from "node:test";
import assert from "node:assert/strict";
import {
  checkBudget,
  estimateCostUsd,
  DEFAULT_BUDGET,
  startOfUtcDay,
  startOfUtcMonth,
  BudgetError,
  PRICING,
} from "../src/budget.js";

const emptyToday = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
const emptyMonth = { costUsd: 0 };

test("cost estimate matches published Hive rates", () => {
  const cost = estimateCostUsd({
    model: "deepseek-ai/deepseek-v4.1-flash-1017",
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
  });
  assert.ok(Math.abs(cost - (0.1 + 0.35)) < 1e-9);
});

test("cached input is billed at the cached rate", () => {
  const cost = estimateCostUsd({
    model: "deepseek-ai/deepseek-v4.1-flash-1017",
    inputTokens: 1_000_000,
    cachedInputTokens: 1_000_000,
    outputTokens: 0,
  });
  assert.ok(Math.abs(cost - 0.003) < 1e-9);
});

test("unknown model returns null rather than guessing", () => {
  assert.equal(estimateCostUsd({ model: "mystery-model", inputTokens: 100, outputTokens: 100 }), null);
});

test("typical read-only run costs well under a cent", () => {
  const cost = estimateCostUsd({
    model: "deepseek-ai/deepseek-v4.1-flash-1017",
    inputTokens: 2000,
    outputTokens: 1500,
  });
  assert.ok(cost < 0.001);
});

test("empty usage passes", () => {
  assert.equal(checkBudget({ today: emptyToday, month: emptyMonth, requestedOutputTokens: 500 }).ok, true);
});

test("output ceiling is enforced", () => {
  assert.throws(
    () => checkBudget({ today: emptyToday, month: emptyMonth, requestedOutputTokens: 5000 }),
    (error) => error.code === "OUTPUT_TOO_LARGE"
  );
});

test("daily request limit blocks", () => {
  assert.throws(
    () =>
      checkBudget({
        today: { ...emptyToday, requests: DEFAULT_BUDGET.dailyRequests },
        month: emptyMonth,
        requestedOutputTokens: 100,
      }),
    (error) => error.code === "DAILY_REQUESTS_EXCEEDED"
  );
});

test("daily token limit blocks", () => {
  assert.throws(
    () =>
      checkBudget({
        today: { ...emptyToday, inputTokens: DEFAULT_BUDGET.dailyTokens, outputTokens: 1 },
        month: emptyMonth,
        requestedOutputTokens: 100,
      }),
    (error) => error.code === "DAILY_TOKENS_EXCEEDED"
  );
});

test("monthly cost limit blocks", () => {
  assert.throws(
    () =>
      checkBudget({
        today: emptyToday,
        month: { costUsd: DEFAULT_BUDGET.monthlyCostUsd },
        requestedOutputTokens: 100,
      }),
    (error) => error.code === "MONTHLY_COST_EXCEEDED"
  );
});

test("unknown usage fails closed", () => {
  assert.throws(
    () => checkBudget({ today: null, month: emptyMonth, requestedOutputTokens: 100 }),
    (error) => error.code === "BUDGET_UNKNOWN"
  );
});

test("day and month boundaries are UTC", () => {
  const t = Date.parse("2026-10-26T23:30:00Z");
  assert.equal(startOfUtcDay(t), "2026-10-26T00:00:00.000Z");
  assert.equal(startOfUtcMonth(t), "2026-10-01T00:00:00.000Z");
});

test("pricing table contains the configured model", () => {
  assert.ok(PRICING["deepseek-ai/deepseek-v4.1-flash-1017"]);
});
