# PURPOSE

Private, owner-directed AI Brand Guru for **On Purpose With Purpose**.
Phase 1 local foundation. Nothing here is deployed, published, sent, or charged.

PURPOSE is not a public website builder, not a SaaS product, and not an autonomous
content creator. It only acts on an explicit owner directive, inside a workflow the
owner has authorized, with policy enforced in code.

## Status

- Phase 0 baseline: `docs/PHASE-0-PLAN.md`
- Phase 1: local CLI, config registries, approval state machine, hash-chained audit
- Phase 2 (local only): D1 schema, Cloudflare Access JWT verification, request router,
  budgeted Hive gateway, versioned config store
- Hive AI: disabled by default, server-side key only
- Deployed: no
- Branch: `develop-ai-studio` only

## Private browser dashboard

A local browser interface and Windows desktop shortcut are available.
See [dashboard/README.md](dashboard/README.md) for installation and usage.
It uses your existing Hive settings, requires confirmation before each AI run,
and keeps history on your computer. The dashboard requires Node.js 22.13 or newer.

## Requirements

Node.js 20 or newer. No third-party dependencies.

## Commands

Run from this directory:

```bash
node bin/purpose.js help
node bin/purpose.js status
node bin/purpose.js workflows
node bin/purpose.js capabilities
node bin/purpose.js gaps
node bin/purpose.js inventory
node bin/purpose.js review
node bin/purpose.js intent examples/read-only-audit.json
node bin/purpose.js request examples/read-only-audit.json
node bin/purpose.js approvals pending
node bin/purpose.js approve <id> "Approved for read-only run"
node bin/purpose.js reject <id> "Not in scope"
node bin/purpose.js draft examples/read-only-audit.json
node bin/purpose.js audit --verify
node bin/purpose.js db-init
node bin/purpose.js db-status
node --test
```

`PURPOSE_DATA_DIR` overrides where `.data/` state is written (used by tests).
`PURPOSE_DB_PATH` overrides the local SQLite path.

## Phase 2 (local foundation only)

```bash
node bin/purpose.js db-init
node bin/purpose.js db-status
node src/local/server.js    # local API; owner auth enforced
node src/local/dry-run.js   # full owner workflow against a stub model, no network
node --test
```

Phase 2 additions:

- `migrations/0001_init.sql` — D1-compatible schema with append-only triggers
- `src/d1.js` — `node:sqlite` adapter exposing the D1 surface
- `src/auth/access.js` + `src/auth/jwt.js` — Cloudflare Access JWT verification using
  WebCrypto only (RS256 and ES256), owner allowlist, step-up re-auth
- `src/policy.js` — shared deny-by-default policy layer
- `src/budget.js` — token and spend ceilings with published Hive pricing
- `src/ai/gateway.js` — budgeted, policy-gated Hive call that can only return a proposal
- `src/api/router.js` — framework-free owner-only router
- `src/store/*` — audit chain, approvals, directives, usage, versioned config

The Phase 2 API has **no** publish, send, charge, booking, or deploy endpoint. Those paths
return 404 because they do not exist.

## Phase 3 dry run

`node src/local/dry-run.js` exercises the complete owner workflow with zero network access:

1. Rejects an unauthenticated request.
2. Authenticates an ephemeral owner identity.
3. Validates a bounded read-only directive.
4. Creates a pending approval.
5. Refuses a supplied approval that is not yet approved.
6. Refuses any write capability.
7. Records an owner approval.
8. Runs the approved analysis against a deterministic stub model.
9. Proves the approval is consumed and cannot be reused.
10. Proves side-effect routes do not exist.
11. Verifies the audit hash chain.

Safety properties:

- The stub model is local; the only HTTP target is `dry-run.invalid`, which cannot resolve.
- The Hive key is the literal string `dry-run-not-a-real-key` and is never transmitted.
- Authentication uses a throwaway in-memory RSA key, not Cloudflare.
- The dry run refuses to start if a real `PURPOSE_OWNER_EMAIL` or `PURPOSE_ACCESS_AUD`
  is present in the environment.
- The database is in memory and leaves no files.
- Output is a proposal with `executed: false`. Nothing is published, sent, charged,
  booked, or deployed.

## Safety model

- Unknown workflows, unknown capabilities, disabled capabilities, and missing fields are
  denied. PURPOSE asks for clarification instead of assuming.
- Capabilities are independent. A research approval does not authorize publishing.
- Drafts and proposals are stored, never executed. Execution is a separate phase and
  requires its own approval record.
- The audit log is append-only and hash-chained. `audit --verify` detects edits.
- Hive requires all of: an owner-approved directive, `HIVE_API_KEY` in the server
  environment, and `PURPOSE_ENABLE_HIVE=1`. Keys are never read from the browser or repo,
  never printed, and never logged.
- Phase 1 Hive use is limited to `research`, `recommend`, and `analytics_view`.

## Phase 1 does NOT do

- No content creation. `draft`, `edit`, `schedule`, `send`, `publish`, `booking_change`,
  and `charge` are disabled in `config/governance.json`.
- No payments, memberships, subscriptions, or customer accounts.
- No website changes, merges, pushes, or deployments.
- No public chatbot.

## Brand standards

`config/brand-standard.json` holds owner-editable standards. Every field starts
`approved: false` with `status: "NEEDS OWNER REVIEW"`. Observed values from the live site
are recorded with a `source` and are **not** treated as policy. While required fields are
unapproved, `assertContentReady()` returns false and content workflows stay blocked.

## Layout

```
bin/purpose.js            CLI entry point
src/config.js             config loaders
src/directive.js          directive validation and approval matrix lookup
src/brand.js              brand readiness and gap reporting
src/inventory.js          inventory summary and review findings
src/audit.js              hash-chained audit log and approval store
src/hive.js               guarded Hive adapter
config/brand-standard.json
config/governance.json
config/inventory/{products,pages,links,assets}.json
examples/*.json           sample directives
test/*.test.js            node:test suites
```

## Owner actions still required

1. Approve or correct each `NEEDS OWNER REVIEW` brand field.
2. Decide branch reconciliation for `develop-ai-studio` (see Phase 0, section 2.2).
3. Confirm canonical contact email and real social profile URLs.
4. Confirm the Hive plan, rate limits, and production-use terms.
5. Approve Phase 2 (private dashboard and owner authentication) before any deployment.
