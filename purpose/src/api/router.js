import { authenticateRequest, requireStepUp, AuthError, ACCESS_HEADER } from "../auth/access.js";
import { evaluateDirective, authorizeCapability, brandGaps, brandReadiness, PolicyError } from "../policy.js";
import { classifyAiError } from "../ai/gateway.js";
import { summarizeInventory } from "../inventory-summary.js";

/**
 * Framework-free request router. It is a plain (request, env, ctx) handler so it can run
 * unchanged on Cloudflare Workers and in local tests.
 *
 * Design rules:
 *  - Every route requires a verified owner identity. There is no anonymous route.
 *  - Routes that do not exist return 404 rather than 403: publish/send/charge/booking
 *    simply are not implemented.
 *  - No route writes to the website, sends email, charges money, or changes bookings.
 */

const READ_CAPABILITIES = new Set(["inventory_view", "research", "recommend", "analytics_view"]);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      ...headers,
    },
  });
}

function errorResponse(code, message, status, details = {}) {
  return json({ error: { code, message, details } }, status);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function createRouter({ stores, env, loadConfig, jwks, fetchJwks, fetchImpl, now }) {
  async function authenticate(request) {
    return authenticateRequest({
      headers: request.headers,
      env,
      jwks,
      fetchJwks,
      now: typeof now === "function" ? now() : now,
    });
  }

  async function currentConfig() {
    const { governance, brandStandard } = await loadConfig();
    return { governance, brandStandard };
  }

  function requireCapability(governance, action) {
    if (!governance.capabilities?.[action]?.enabled) {
      throw new PolicyError("CAPABILITY_DISABLED", `Capability "${action}" is disabled.`, {
        phase: governance.capabilities?.[action]?.phase,
      });
    }
  }

  return async function route(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();

    try {
      const identity = await authenticate(request);

      if (method === "GET" && path === "/api/status") {
        const { governance } = await currentConfig();
        return json({
          project: "PURPOSE",
          phase: governance.phase,
          mode: governance.mode,
          role: identity.role,
          owner: identity.email,
          workflowsEnabled: Object.entries(governance.workflows)
            .filter(([, wf]) => wf.enabled)
            .map(([id]) => id),
          capabilitiesEnabled: Object.entries(governance.capabilities)
            .filter(([, cap]) => cap.enabled)
            .map(([id]) => id),
          hive: { configured: Boolean(env.HIVE_API_KEY), enabled: env.PURPOSE_ENABLE_HIVE === "1" },
          deployed: false,
        });
      }

      if (method === "GET" && path === "/api/workflows") {
        const { governance } = await currentConfig();
        return json(Object.entries(governance.workflows).map(([id, wf]) => ({
          id,
          enabled: wf.enabled,
          phase: wf.phase,
          allowedActions: wf.allowedActions,
          requiresBrandStandard: wf.requiresBrandStandard,
        })));
      }

      if (method === "GET" && path === "/api/capabilities") {
        const { governance } = await currentConfig();
        requireCapability(governance, "inventory_view");
        return json(Object.entries(governance.capabilities).map(([id, cap]) => ({
          id,
          enabled: cap.enabled,
          phase: cap.phase,
          requiresApproval: cap.requiresApproval,
          channelRequired: cap.channelRequired ?? false,
          ownerOnly: cap.ownerOnly ?? false,
        })));
      }

      if (method === "GET" && path === "/api/brand") {
        const { governance, brandStandard } = await currentConfig();
        requireCapability(governance, "inventory_view");
        return json({ gaps: brandGaps(brandStandard), readiness: brandReadiness(brandStandard) });
      }

      if (method === "GET" && path === "/api/inventory") {
        const { governance } = await currentConfig();
        requireCapability(governance, "inventory_view");
        return json(summarizeInventory());
      }

      if (method === "GET" && path === "/api/approvals") {
        const status = url.searchParams.get("status") || undefined;
        return json(await stores.approvals.list(status));
      }

      if (method === "POST" && path === "/api/directives/validate") {
        const body = await readJsonBody(request);
        const { governance } = await currentConfig();
        const result = evaluateDirective(body ?? {}, governance);
        if (!result.ok) {
          await stores.audit.append({
            type: "directive.clarification",
            actor: identity.email,
            payload: { code: result.code, message: result.message },
          });
          return json(result, 422);
        }
        const saved = await stores.directives.create({
          workflow: result.directive.workflow,
          action: result.directive.action,
          request: result.directive.request,
          scope: result.directive.scope,
          audience: result.directive.audience,
          channel: result.directive.channel,
          notes: result.directive.notes,
          actor: identity.email,
          status: "validated",
        });
        await stores.audit.append({
          type: "directive.created",
          actor: identity.email,
          payload: { directiveId: saved.id, workflow: saved.workflow, action: saved.action },
        });
        return json({ ok: true, directive: saved }, 201);
      }

      if (method === "POST" && path === "/api/approvals") {
        const body = await readJsonBody(request);
        const { governance } = await currentConfig();
        const result = evaluateDirective(body ?? {}, governance);
        if (!result.ok) return json(result, 422);

        const directive = await stores.directives.create({
          workflow: result.directive.workflow,
          action: result.directive.action,
          request: result.directive.request,
          scope: result.directive.scope,
          audience: result.directive.audience,
          channel: result.directive.channel,
          notes: result.directive.notes,
          actor: identity.email,
          status: "validated",
        });

        const approval = await stores.approvals.create({
          directiveId: directive.id,
          action: directive.action,
          workflow: directive.workflow,
          summary: directive.request,
          artifact: { scope: directive.scope, audience: directive.audience, channel: directive.channel },
          requestedBy: identity.email,
        });

        await stores.audit.append({
          type: "directive.created",
          actor: identity.email,
          payload: { directiveId: directive.id, approvalId: approval.id, action: directive.action },
        });

        return json({ ok: true, directive, approval }, 201);
      }

      const decisionMatch = path.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);
      if (method === "POST" && decisionMatch) {
        const [, id, verb] = decisionMatch;
        const { governance } = await currentConfig();
        requireCapability(governance, "config_edit");
        requireStepUp(identity, { now: typeof now === "function" ? now() : now });

        const body = (await readJsonBody(request)) ?? {};
        const decision = verb === "approve" ? "approved" : "rejected";
        const current = await stores.approvals.get(id);
        if (!current) {
          return errorResponse("APPROVAL_NOT_FOUND", "No approval with that id exists.", 404);
        }
        if (current.status !== "pending") {
          return errorResponse(
            "APPROVAL_ALREADY_DECIDED",
            `This approval is already ${current.status}.`,
            409,
            { status: current.status }
          );
        }
        let record;
        try {
          record = await stores.approvals.decide(id, decision, {
            note: body.note ?? "",
            decidedBy: identity.email,
          });
        } catch (error) {
          return errorResponse("APPROVAL_CONFLICT", "The approval changed before it could be decided.", 409);
        }
        await stores.audit.append({
          type: decision === "approved" ? "approval.granted" : "approval.rejected",
          actor: identity.email,
          payload: { approvalId: record.id, action: record.action, workflow: record.workflow },
        });
        return json(record);
      }

      if (method === "GET" && path === "/api/audit") {
        const { governance } = await currentConfig();
        requireCapability(governance, "audit_view");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
        return json(await stores.audit.list(limit));
      }

      if (method === "GET" && path === "/api/audit/verify") {
        const { governance } = await currentConfig();
        requireCapability(governance, "audit_view");
        return json(await stores.audit.verify());
      }

      if (method === "POST" && path === "/api/ai/analyze") {
        const body = await readJsonBody(request);
        const { governance, brandStandard } = await currentConfig();
        const result = evaluateDirective(body ?? {}, governance);
        if (!result.ok) return json(result, 422);

        const approval = body?.approvalId ? await stores.approvals.get(body.approvalId) : null;
        const directiveId = body?.directiveId ?? null;

        try {
          const { runAnalysis } = await import("../ai/gateway.js");
          const output = await runAnalysis({
            directive: { ...result.directive, id: directiveId },
            approval,
            governance,
            brandStandard,
            stores,
            env,
            fetchImpl,
            now: typeof now === "function" ? now() : now,
            requestedOutputTokens: body?.maxOutputTokens,
            actor: identity.email,
          });
          return json(output);
        } catch (error) {
          const mapped = classifyAiError(error);
          if (mapped) {
            await stores.audit.append({
              type: "hive.blocked",
              actor: identity.email,
              payload: { code: mapped.code },
            });
            return errorResponse(mapped.code, mapped.message, mapped.status, mapped.details);
          }
          throw error;
        }
      }

      return errorResponse("NOT_FOUND", "This endpoint does not exist in PURPOSE Phase 2.", 404);
    } catch (error) {
      if (error instanceof AuthError) {
        return errorResponse(error.code, error.message, error.status);
      }
      if (error instanceof PolicyError) {
        return errorResponse(error.code, error.message, error.status, error.details);
      }
      return errorResponse("INTERNAL", "An unexpected error occurred.", 500);
    }
  };
}

export { json, errorResponse, READ_CAPABILITIES, ACCESS_HEADER };
