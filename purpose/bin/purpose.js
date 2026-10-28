#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { loadBrandStandard, loadGovernance } from "../src/config.js";
import { USAGE, formatJson } from "../src/usage.js";
import { validateDirective, DirectiveError } from "../src/directive.js";
import { AuditLog, ApprovalStore } from "../src/audit.js";
import { summarizeGaps } from "../src/brand.js";
import { inventorySummary, inventoryReview } from "../src/inventory.js";
import { hiveStatus, callHive, HiveBlockedError } from "../src/hive.js";
import { migrateLocalDb, openLocalDb } from "../src/local/db.js";
import { AuditChain } from "../src/store/audit-chain.js";
import { ApprovalRepository } from "../src/store/approvals.js";
import { ConfigStore } from "../src/store/config.js";

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Cannot read JSON from ${path}: ${error.message}`);
  }
}

function statusCommand() {
  const gov = loadGovernance();
  const brand = loadBrandStandard();
  const gaps = summarizeGaps();
  const inv = inventorySummary();
  return {
    project: gov.project,
    owner: gov.owner.displayName,
    phase: gov.phase,
    mode: gov.mode,
    deployed: gov.deployed,
    branchPolicy: "develop-ai-studio only. No merge, push, or deploy.",
    workflowsEnabled: Object.entries(gov.workflows)
      .filter(([, wf]) => wf.enabled)
      .map(([id]) => id),
    capabilitiesEnabled: Object.entries(gov.capabilities)
      .filter(([, cap]) => cap.enabled)
      .map(([id]) => id),
    brandStandardApproved: Object.values(brand.fields).filter((f) => f.approved).length,
    brandStandardOpen: gaps.open,
    brandStandardRequiredOpen: gaps.requiredOpen,
    inventory: inv,
    hive: hiveStatus(),
    integrations: gov.integrations,
  };
}

function workflowsCommand() {
  const gov = loadGovernance();
  return Object.entries(gov.workflows).map(([id, wf]) => ({
    id,
    enabled: wf.enabled,
    phase: wf.phase,
    allowedActions: wf.allowedActions,
    requiresBrandStandard: wf.requiresBrandStandard,
    description: wf.description,
  }));
}

function capabilitiesCommand() {
  const gov = loadGovernance();
  return Object.entries(gov.capabilities).map(([id, cap]) => ({
    id,
    enabled: cap.enabled,
    phase: cap.phase,
    requiresApproval: cap.requiresApproval,
    channelRequired: cap.channelRequired ?? false,
    ownerOnly: cap.ownerOnly ?? false,
    description: cap.description,
  }));
}

function gapsCommand() {
  return summarizeGaps();
}

function inventoryCommand() {
  return inventorySummary();
}

function reviewCommand() {
  return {
    readOnly: true,
    findings: inventoryReview(),
  };
}

function intentCommand(file) {
  if (!file) fail("intent requires a JSON file path");
  const gov = loadGovernance();
  const log = new AuditLog();
  const raw = readJsonFile(file);
  try {
    const directive = validateDirective(raw, gov);
    log.append("directive.created", directive.actor, {
      workflow: directive.workflow,
      action: directive.action,
      request: directive.request,
    });
    return { accepted: true, directive };
  } catch (error) {
    if (error instanceof DirectiveError) {
      log.append("directive.clarification", raw.actor || "owner", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return { accepted: false, code: error.code, message: error.message, details: error.details };
    }
    throw error;
  }
}

function approvalsCommand(status) {
  const store = new ApprovalStore();
  return store.list(status || undefined);
}

function requestCommand(file) {
  if (!file) fail("request requires a JSON file path");
  const gov = loadGovernance();
  const store = new ApprovalStore();
  const log = new AuditLog();
  const raw = readJsonFile(file);

  let directive;
  try {
    directive = validateDirective(raw, gov);
  } catch (error) {
    if (error instanceof DirectiveError) {
      log.append("directive.clarification", raw.actor || "owner", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return { created: false, code: error.code, message: error.message, details: error.details };
    }
    throw error;
  }

  const record = store.request({
    action: directive.action,
    workflow: directive.workflow,
    summary: directive.request,
    artifact: { scope: directive.scope, audience: directive.audience, channel: directive.channel },
    requestedBy: directive.actor,
  });
  log.append("directive.created", directive.actor, {
    workflow: directive.workflow,
    action: directive.action,
    request: directive.request,
    approvalId: record.id,
  });
  return { created: true, approval: record };
}

function approveCommand(id, note) {
  if (!id) fail("approve requires an approval id");
  const store = new ApprovalStore();
  const log = new AuditLog();
  const record = store.decide(id, "approved", note);
  log.append("approval.granted", "owner", { id: record.id, action: record.action, workflow: record.workflow });
  return record;
}

function rejectCommand(id, note) {
  if (!id) fail("reject requires an approval id");
  const store = new ApprovalStore();
  const log = new AuditLog();
  const record = store.decide(id, "rejected", note);
  log.append("approval.rejected", "owner", { id: record.id, action: record.action, workflow: record.workflow });
  return record;
}

function auditCommand(verify) {
  const log = new AuditLog();
  if (verify) return log.verify();
  return log.readEntries();
}

async function dbInitCommand() {
  const result = migrateLocalDb();
  return {
    created: true,
    path: result.path,
    migrations: result.applied,
    note: "Local SQLite database only. Nothing was deployed or published.",
  };
}

async function dbStatusCommand() {
  const { db, path, exists } = openLocalDb();
  if (!exists || !db) {
    return { exists: false, path, note: "Run `node bin/purpose.js db-init` to create it." };
  }
  const count = async (table) => {
    try {
      const row = await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).first();
      return Number(row.c);
    } catch {
      return null;
    }
  };
  const [directives, approvals, auditEvents, usage, configVersions] = await Promise.all([
    count("directives"),
    count("approvals"),
    count("audit_events"),
    count("usage_ledger"),
    count("config_versions"),
  ]);
  const chain = new AuditChain(db);
  const verify = await chain.verify();
  const latestConfig = await new ConfigStore(db).latest("governance");
  db.close();
  return {
    exists: true,
    path,
    rows: { directives, approvals, auditEvents, usage, configVersions },
    audit: verify,
    governanceVersion: latestConfig?.version ?? null,
    governanceApproved: Boolean(latestConfig?.approvedBy),
  };
}

async function draftCommand(file) {
  if (!file) fail("draft requires a JSON file path");
  const gov = loadGovernance();
  const brand = loadBrandStandard();
  const log = new AuditLog();
  const approvals = new ApprovalStore();
  const raw = readJsonFile(file);

  let directive;
  try {
    directive = validateDirective(raw, gov);
  } catch (error) {
    if (error instanceof DirectiveError) {
      log.append("directive.clarification", raw.actor || "owner", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return { executed: false, code: error.code, message: error.message, details: error.details };
    }
    throw error;
  }

  const approval = raw.approvalId ? approvals.get(raw.approvalId) : null;
  try {
    const result = await callHive({ directive, governance: gov, brandStandard: brand, approval });
    log.append("hive.requested", "owner", {
      workflow: directive.workflow,
      action: directive.action,
      model: result.model,
      usage: result.usage,
    });
    return { executed: false, directive, result };
  } catch (error) {
    if (error instanceof HiveBlockedError) {
      log.append("hive.blocked", raw.actor || "owner", { code: error.code, message: error.message });
      return { executed: false, code: error.code, message: error.message, details: error.details };
    }
    throw error;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "status":
      process.stdout.write(`${formatJson(statusCommand())}\n`);
      break;
    case "workflows":
      process.stdout.write(`${formatJson(workflowsCommand())}\n`);
      break;
    case "capabilities":
      process.stdout.write(`${formatJson(capabilitiesCommand())}\n`);
      break;
    case "gaps":
      process.stdout.write(`${formatJson(gapsCommand())}\n`);
      break;
    case "inventory":
      process.stdout.write(`${formatJson(inventoryCommand())}\n`);
      break;
    case "review":
      process.stdout.write(`${formatJson(reviewCommand())}\n`);
      break;
    case "intent":
      process.stdout.write(`${formatJson(intentCommand(args[0]))}\n`);
      break;
    case "request":
      process.stdout.write(`${formatJson(requestCommand(args[0]))}\n`);
      break;
    case "approvals":
      process.stdout.write(`${formatJson(approvalsCommand(args[0]))}\n`);
      break;
    case "approve":
      process.stdout.write(`${formatJson(approveCommand(args[0], args.slice(1).join(" ")))}\n`);
      break;
    case "reject":
      process.stdout.write(`${formatJson(rejectCommand(args[0], args.slice(1).join(" ")))}\n`);
      break;
    case "audit":
      process.stdout.write(`${formatJson(auditCommand(args.includes("--verify")))}\n`);
      break;
    case "db-init":
      process.stdout.write(`${formatJson(await dbInitCommand())}\n`);
      break;
    case "db-status":
      process.stdout.write(`${formatJson(await dbStatusCommand())}\n`);
      break;
    case "draft":
      process.stdout.write(`${formatJson(await draftCommand(args[0]))}\n`);
      break;
    case "help":
    case "--help":
    case undefined:
      process.stdout.write(USAGE);
      break;
    default:
      fail(`Unknown command: ${command}\n\n${USAGE}`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
