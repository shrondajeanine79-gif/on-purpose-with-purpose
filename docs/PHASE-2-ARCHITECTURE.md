# PURPOSE — Phase 2 Architecture (Owner-Only Dashboard)

Status: PROPOSED. Not approved. Nothing built, deployed, or connected.
Scope: private, owner-only control surface for PURPOSE. No public builder, no SaaS.
Prerequisite: Phase 0 baseline (`docs/PHASE-0-PLAN.md`) and Phase 1 local foundation.

---

## 1. Goals and non-goals

### Goals
1. Give the owner one private place to review brand gaps, inventory, directives,
   approvals, and the audit trail.
2. Move Phase 1 local state (`.data/`) into durable storage without changing the safety
   model or the hash-chain guarantees.
3. Put the Hive AI key in a server-side secret and make every AI call pass the same
   policy gates the CLI already enforces.
4. Prove that no draft, proposal, or analysis can execute a side effect.

### Non-goals in Phase 2
- No publishing, sending, charging, booking changes, or live-site edits.
- No memberships, subscriptions, digital-product checkout, or customer accounts.
- No public visitor chatbot.
- No multi-user roles beyond the single owner.
- No changes to GitHub Pages, DNS, `CNAME`, or the live website.

---

## 2. Isolation from Purpose Data Scout

PURPOSE and Purpose Data Scout are separate products. No Data Scout artifacts were found
in this workspace at verification time, so the boundary is defined now, before either
grows.

| Concern | Rule |
|---|---|
| Source control | Separate repository. No shared commits, no subtree, no submodule. |
| Hosting | Separate Cloudflare Pages project and separate Worker. |
| Data | Separate D1 database and separate R2 bucket. No shared tables. |
| Identity | Separate Cloudflare Access application and policy. |
| Secrets | Separate Hive key (or separate scoped key). Never share a key or a quota. |
| Audit | Separate hash chain. No cross-writing. |
| Code | No imports between trees. Shared helpers must be copied, not cross-linked. |
| Naming | PURPOSE resources prefixed `purpose-`; Data Scout resources prefixed its own. |
| Data sharing | Owner-approved exports only. No live cross-database reads. |

If Data Scout later needs PURPOSE data, it must request an owner-approved export, not a
direct connection.

---

## 3. Architecture

```
Owner browser
  Cloudflare Access (owner email allowlist, MFA enforced)
        |
        | short-lived Access JWT on every request
        v
PURPOSE dashboard  (Cloudflare Pages, static, no secrets, no service bindings)
  - read-only views, directive composer, approval queue, audit viewer
        |
        v
PURPOSE API  (Cloudflare Worker)
  - Access JWT verification (issuer, audience, expiry, signature)
  - policy engine (port of src/directive.js + brand gate)
  - workflow registry (port of config/governance.json)
  - approval state machine (port of src/audit.js)
  - audit writer (hash chain, append-only)
  - Hive adapter (secret binding only)
        |
        +--> D1: config_versions, directives, approvals, audit_events, usage_ledger
        +--> R2: artifact bodies, daily audit anchors, exports
        +--> Hive AI API (Authorization header assembled server-side only)
        +--> KV (optional): rate-limit counters, session nonce cache
```

Trust boundaries:
- Browser is untrusted. It never holds a Hive key, a service token, or a DB binding.
- The Worker is the only component that can reach D1, R2, or Hive.
- Cloudflare Access is the outer gate; the Worker independently verifies the JWT on every
  request. Access alone is not treated as sufficient authorization.

---

## 4. Authentication and authorization

### 4.1 Owner authentication
- Cloudflare Access self-hosted application protecting the dashboard hostname.
- Policy: allow only the owner's email identity, MFA required, one-seat.
- Worker verifies the `Cf-Access-Jwt-Assertion` header: signature against the team's
  public keys, `aud` matches the application tag, `iss` matches the team domain, `exp`
  valid, clock skew bounded.
- No anonymous route exists. No "public preview" route.

### 4.2 Step-up re-authentication
High-risk capabilities require a fresh re-auth timestamp, not just a valid session:
`schedule`, `send`, `publish`, `booking_change`, `charge`, `config_edit`.
Phase 2 enables only `config_edit`, which requires step-up even though it changes only
owner-owned standards.

### 4.3 Authorization
- Single role: `owner`. No viewer/admin split until a second person exists.
- Capability checks reuse the Phase 1 registry exactly. Same deny-by-default behavior.
- Every request carries an explicit capability. There is no implicit "admin" bypass.

---

## 5. Data model (D1)

Migrations are versioned files, applied forward only, never edited after merge.

```sql
config_versions(
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,              -- brand_standard | governance
  version INTEGER NOT NULL,
  body TEXT NOT NULL,              -- canonical JSON
  body_sha256 TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL
);

directives(
  id TEXT PRIMARY KEY,
  workflow TEXT NOT NULL,
  action TEXT NOT NULL,
  request TEXT NOT NULL,
  scope TEXT,
  audience TEXT,
  channel TEXT,
  notes TEXT,
  actor TEXT NOT NULL,
  status TEXT NOT NULL,            -- validated | clarification | denied
  created_at TEXT NOT NULL
);

approvals(
  id TEXT PRIMARY KEY,
  directive_id TEXT NOT NULL,
  action TEXT NOT NULL,
  workflow TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,            -- pending | approved | rejected | consumed
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  decision_note TEXT,
  consumed_at TEXT,
  FOREIGN KEY (directive_id) REFERENCES directives(id)
);

audit_events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
-- Append-only enforced by trigger: REJECT UPDATE and DELETE on audit_events.

usage_ledger(
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd REAL,
  directive_id TEXT,
  outcome TEXT                     -- ok | blocked | error
);
```

Rules:
- `audit_events` has `BEFORE UPDATE` and `BEFORE DELETE` triggers that abort.
- The hash chain continues Phase 1's algorithm (`sha256` over canonical JSON of the body
  including `prevHash`). `purpose audit --verify` works unchanged against D1.
- A daily job writes the latest `(seq, hash)` to R2 as an anchor, so truncation is
  detectable, not just edits.

---

## 6. Approved API surface for Phase 2

Read-only plus owner config. No execution endpoints exist.

| Method | Path | Capability | Notes |
|---|---|---|---|
| GET | `/api/status` | session | build, phase, Hive readiness, no keys |
| GET | `/api/brand` | inventory_view | standards with gap markers |
| GET | `/api/inventory` | inventory_view | products, pages, links, assets |
| GET | `/api/review` | inventory_view | read-only findings |
| GET | `/api/workflows` | session | registry and enabled state |
| GET | `/api/capabilities` | session | matrix |
| POST | `/api/directives/validate` | research | validate only; no AI call |
| POST | `/api/approvals` | research | create pending approval |
| GET | `/api/approvals` | session | list by status |
| POST | `/api/approvals/:id/approve` | config_edit-level step-up | owner decision |
| POST | `/api/approvals/:id/reject` | config_edit-level step-up | owner decision |
| GET | `/api/audit` | audit_view | paginated |
| GET | `/api/audit/verify` | audit_view | chain verification |
| POST | `/api/ai/analyze` | research / recommend | gated, read-only output |

Explicitly absent: publish, send, charge, booking, deploy, merge, file-write,
GitHub-write. Those return 404, not 403, because they do not exist.

---

## 7. Secure Hive AI integration

### 7.1 Secret handling
- `HIVE_API_KEY` is a Worker secret (`wrangler secret put`). Never in `wrangler.toml`,
  never in Pages, never in the bundle, never in logs.
- Secret rotation is a documented runbook step; the old key is revoked after cutover.
- The Worker never echoes the key, its length, or a prefix in errors or telemetry.

### 7.2 Request path
1. Verify Access JWT and capability.
2. Load the current approved `governance` and `brand_standard` versions from D1.
3. Re-run the Phase 1 guards in this order: workflow enabled, action allowed, capability
   enabled, channel present when required, brand readiness when required, approval
   present when required.
4. Check the spend and rate budget.
5. Call Hive with a bounded `max_tokens` from governance, a fixed low temperature, and a
   server-built instruction string.
6. Validate the response shape, strip control characters, cap length.
7. Store the output as a proposal artifact in R2 with `executed: false`.
8. Append `hive.requested` or `hive.blocked` plus a usage ledger row.

Any failure before step 5 means no network call is made. Tests assert "fetch not called".

### 7.3 Prompt-injection defense
- All external text (inventory text, page copy, analytics, emails) is wrapped as data and
  labeled untrusted.
- The system prompt states the model has no tools and no authority to act.
- The model cannot choose a workflow, a capability, or an approval. Those are server-side.
- Model output is never parsed for instructions. It is stored as text only.

### 7.4 Cost control
- Per-request `max_tokens` ceiling from governance (currently 1200).
- Daily and monthly token budgets in D1; exceeding either returns a hard block with an
  audit event.
- Usage ledger records estimated cost at DeepSeek V4.1 Flash rates: $0.10 per 1M input,
  $0.35 per 1M output. Cached reads noted separately at $0.003 per 1M.
- No automatic retries that could multiply spend. One attempt, explicit owner retry.

### 7.5 Read-only by construction
The Hive adapter has no tool-calling, no function-calling, no URL fetching, and no write
credentials. Even a fully compromised model response can only produce text.

---

## 8. Phase 2 capability matrix

| Capability | Phase 2 | Approval | Step-up | Notes |
|---|---|---|---|---|
| session/status view | enabled | no | no | no sensitive values |
| inventory_view | enabled | no | no | read-only |
| audit_view | enabled | no | no | append-only source |
| research | enabled | no | no | gated AI, bounded |
| recommend | enabled | no | no | gated AI, bounded |
| analytics_view | enabled | no | no | local inventory only; no external analytics connected |
| config_edit | enabled | yes | yes | owner edits standards; versioned |
| draft / edit | disabled | yes | no | Phase 3 |
| schedule / send / publish | disabled | yes | yes | Phase 6 |
| booking_change / charge | disabled | yes | yes | Phase 6 |

---

## 9. Testing plan

- Unit: port Phase 1 suites to run against the Worker handlers with a fake D1.
- Auth: reject missing, expired, wrong-audience, and wrong-signature JWTs.
- Authorization: every endpoint denies when the capability is disabled.
- Approval: cannot consume without approval; cannot reuse; cross-action approval rejected.
- Audit: tamper a row via direct SQL and prove `verify` fails; prove triggers block
  UPDATE/DELETE.
- Hive: prove no fetch on any guard failure; prove key never appears in responses or logs;
  prove token cap and budget block.
- Isolation: prove no Data Scout identifiers, bindings, or keys are referenced.
- E2E: single owner login, complete a read-only analysis, verify audit entries.
- No test may call the real Hive API. A stub is used everywhere.

---

## 10. Cost (free-first)

| Component | Tier | Expected at owner-only volume |
|---|---|---|
| Cloudflare Pages | Free | $0 |
| Cloudflare Workers | Free (100k req/day) | $0; ~$5/mo paid only if exceeded |
| Cloudflare Access | Free up to 50 users | $0 (one seat) |
| D1 | Free tier | $0 |
| R2 | Free tier, no egress fee | ~$0 |
| Hive AI | Usage-based | ~$0.0007 per read-only run; cents per month at this scale |
| Domain / Pages | Existing | $0 change |

---

## 11. Branch and repository strategy (recommendation only, nothing executed)

### Critical constraint discovered
The repository is **public**, and GitHub Pages publishes **every file** in the deployed
branch. If `purpose/` is ever merged into `main`, these become publicly fetchable at
`https://on-purpose-with-purpose.org/purpose/...`:

- `purpose/config/governance.json` (internal rules and approval matrix)
- `purpose/config/brand-standard.json` (owner gap analysis)
- `purpose/src/*.js` (admin logic)
- `purpose/README.md` and `docs/PHASE-0-PLAN.md` (internal strategy)

`.nojekyll` is present, so nothing is excluded by Jekyll rules. There is no safe
"keep it in the repo but don't publish it" option while deploying from `main`.

### Recommended: separate private repository
1. Back up the untracked work outside the repo first.
2. Create a private repository for PURPOSE.
3. Move `purpose/` and `docs/` there; commit the Phase 1 foundation as its first commit.
4. Keep this repo for the public website only.

Benefits: zero Pages exposure, no branch divergence entanglement, no risk to `main`, and a
clean Data Scout boundary.

### Alternative: local-only until Phase 2 is finished
Keep the files untracked and back them up, then decide. Allowed, but untracked files are
one `git clean -fd` away from deletion, so a backup is mandatory either way.

### Not recommended
Committing PURPOSE to `develop-ai-studio` and later merging to `main` would publish the
admin surface. Avoid.

### Divergence is not blocking
`develop-ai-studio` is 1 commit ahead and 56 behind `origin/main`, but **zero purpose/docs
paths collide with `origin/main`**, so the work can be relocated without touching website
files. No merge, rebase, or cherry-pick is required.

---

## 12. Owner decisions required before Phase 2 build

1. Approve the separate private repository (recommended) or choose local-only.
2. Approve the branch/repo plan in section 11.
3. Cloudflare account and team domain for Access; owner email identity.
4. Confirm Hive plan, rate limits, and production-use terms.
5. Supply approved brand standards (blocks any content workflow, not Phase 2 read-only).
6. Confirm canonical contact email and real social profile URLs.
7. Approve the daily/monthly token and spend caps.
