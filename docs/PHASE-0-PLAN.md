# PURPOSE — Phase 0 Plan and Baseline Record

Status: Phase 0 documentation complete. Phase 1 local foundation in progress.
Owner: Shronda (single owner/operator).
Project: PURPOSE, a private, owner-directed AI Brand Guru for On Purpose With Purpose.
Prepared: 2026-10-26.
Branch: `develop-ai-studio` only.
No deployment, merge, push, or live-site change was performed.

---

## 1. Purpose of this phase

Record an accurate baseline of the existing website and governance needs before any
automation exists, and define the rules that PURPOSE must enforce in code.

PURPOSE is not a public website builder, not a SaaS product, and not an autonomous
content creator. It is an owner-only assistant that may only act on explicit owner
direction and within workflows the owner has authorized.

---

## 2. Verified baseline

### 2.1 Repository and deployment

| Item | Observed value |
|---|---|
| Repository | `shrondajeanine79-gif/on-purpose-with-purpose` (public) |
| Default branch | `main` |
| Live source branch | `main`, HEAD `eba0c63` |
| Pages source | branch-based `main`, root (`/`) |
| Custom domain | `on-purpose-with-purpose.org` |
| Apex DNS | GitHub Pages A records: `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` |
| `www` DNS | CNAME to `shrondajeanine79-gif.github.io` |
| HTTPS | Serving successfully |
| `CNAME` file | Present, value `on-purpose-with-purpose.org`, identical in `main` and live |
| `.nojekyll` | Present |
| Workflow files | None; no `.github/workflows` |
| 404 behavior | Serves `404.html` |

Deployment must continue to be branch-based from `main`. PURPOSE will not alter Pages
settings, DNS, the domain, or the `CNAME` file.

### 2.2 Local branch divergence — critical

| Item | Observed value |
|---|---|
| Current branch | `develop-ai-studio` |
| Local HEAD | `07f063f` (`.gitignore` only ahead of branch point) |
| Branch point | `6818576` |
| Commits on `origin/main` since branch point | 56 |
| Commits on local branch not in `origin/main` | 1 (`07f063f`) |
| Remote `develop-ai-studio` | Does not exist |
| Upstream tracking | Not configured |
| Local `index.html` | 429 lines, older design, Pexels imagery — not live |
| Live `index.html` | 167 lines, uses `css/style.css`, `js/site.js` |

Consequence: this local branch does not contain the live site. It must not be merged
into `main`. Future work must not be based on the stale local tree if it is intended to
eventually touch the live site.

Owner decision required (not performed): whether to rebuild `develop-ai-studio` from
`origin/main` and re-apply the `.gitignore` commit. No merge, reset, cherry-pick, or push
has been done.

### 2.3 Live pages

Verified HTTP 200: `index.html`, `about.html`, `live.html`, `permission-slips.html`,
`contact.html`, `free-guide.html`, `community.html`, `connect.html`, `shop.html`,
`wellness.html`, `404.html`.

Two styling generations coexist:

- `index`, `about`, `live`, `permission-slips`, `contact`, `free-guide`, `404` use
  `css/style.css` and `js/site.js`.
- `community`, `connect`, `shop`, `wellness` use `assets/css/style.css` and
  `assets/js/main.js`.

Both stylesheets are reachable. No build step, no package manifest, no tests exist in the
repository.

### 2.4 Observed brand artifacts (facts, not policy)

- Fonts referenced live: `Allura`, `Playfair Display`, `Inter`.
- Palette tokens observed in live `css/style.css`: cream `#F5F0E1`, ivory `#FFFDF7`,
  teal `#0d9488`, teal dark `#0f766e`, indigo `#1e1b4b`, purple `#311042`,
  gold `#ca8a04`, line `#e3dcc7`.
- Imagery present: `images/shronda.jpg`, `images/nappy-field.jpg`, `images/nappy-garden.jpg`.
- No logo asset exists at the root (`logo.png` and `images/logo.png` return 404).
- No favicon exists (`favicon.ico` and `apple-touch-icon.png` return 404).
- No brand kit file, voice guide, or standards document exists in the repository.

Observed visual artifacts are recorded so PURPOSE does not guess. They are not treated as
approved brand policy. Missing standards are marked `NEEDS OWNER REVIEW`.

### 2.5 Production defects found (not fixed)

1. Newsletter forms post to the literal string `[MAILERLITE_FORM_URL]`.
2. `[DAY & TIME]` placeholder is visible on the live homepage.
3. Social links point to bare domains (`https://facebook.com`, `https://youtube.com`,
   `https://instagram.com`, `https://tiktok.com`, `https://linkedin.com`,
   `https://ko-fi.com`). Commit `48e77d2` states these were deliberately restored from the
   submitted site, so they are recorded as-is and marked for owner review, not corrected.
4. Two different contact emails exist: `on-purpose-with-purpose@outlook.com` on
   `contact.html`, `shrondajeanine@shrondajeanineco.com` on `connect.html`.
5. `WEBSITE_AUDIT.md` is publicly served at `/WEBSITE_AUDIT.md`.
6. No `canonical`, `og:url`, Twitter card, `sitemap.xml`, `robots.txt`, or structured data.
   `og:image` is a relative path, which social scrapers cannot resolve.
7. No security headers (CSP, HSTS, `X-Content-Type-Options`). This is a GitHub Pages
   limitation and a further reason the admin surface must live on a separate origin.

### 2.6 Link in Bio inventory (observed)

Source: `https://shrondajeanine79-gif.github.io/link-in-bio/`.

| Label | URL as published | Assessment |
|---|---|---|
| YouTube Channel | `https://youtube.com` | Bare domain, NEEDS OWNER REVIEW |
| Facebook Connection | `https://facebook.com` | Bare domain, NEEDS OWNER REVIEW |
| Instagram Feed | `https://instagram.com` | Bare domain, NEEDS OWNER REVIEW |
| TikTok Videos | `https://tiktok.com` | Bare domain, NEEDS OWNER REVIEW |
| LinkedIn Profile | `https://linkedin.com` | Bare domain, NEEDS OWNER REVIEW |
| Support on Facebook | `https://facebook.comsubscribe/` | Malformed, NEEDS OWNER REVIEW |
| Support on Ko-fi | `https://ko-fi.com` | Bare domain, NEEDS OWNER REVIEW |
| Contact | `mailto:shronda779@gmail.com` | Third distinct email, NEEDS OWNER REVIEW |
| GitHub Code Archive | `https://github.com` | Bare domain, NEEDS OWNER REVIEW |

Profile image: `profilepic.jpg` on the same site. Live site links to the Link in Bio page
from the homepage and footer.

### 2.7 Revenue surface (observed)

- `shop.html` presents three future offerings: an eBook ("Unshakeable: 30 Days to Reclaim
  Your Power, Peace & Purpose", in development), affirmation/reflection downloads (in
  development), and classes/experiences (future).
- `shop.html` explicitly states no payments are collected.
- No payment provider references (Stripe, PayPal, Gumroad, etc.) were found in the
  inspected live pages.
- Ko-fi is linked but only as a bare domain.
- No membership, subscription, service-booking, or revenue-reporting system exists.

---

## 3. Governance model PURPOSE must enforce in code

### 3.1 Non-negotiable rules

1. No content creation without an explicit owner directive.
2. Every task must use owner-supplied standards, scope, audience, and guardrails.
   Missing policy is requested from the owner, never invented.
3. Ambiguous, missing, or conflicting requirements produce a clarification request.
4. Capabilities are separate: research, recommend, draft, edit, schedule, send, publish,
   booking change, charge, configuration edit, analytics view. Approval for one never
   implies another.
5. Analysis never triggers generation, sending, or publication.
6. No autonomous newsletters, blogs, social posts, campaigns, product copy, or promotions.
7. No live-site change, outbound message, booking change, charge, or publication without
   explicit owner approval.
8. Every instruction, draft, proposed action, approval, and execution is logged.
9. Owner-only authentication; a public chatbot is a separate, separately approved feature.
10. Brand standards and governance live in an owner-editable registry and are enforced by
    application logic, not only by a model prompt.
11. Existing website, domain, `CNAME`, GitHub Pages, and this branch are preserved. Hive
    keys stay server-side. No deploy without authorization.

### 3.2 Enforcement design

- Directive gate: schema-validated instructions with a known workflow, scope, and output.
- Workflow registry: only pre-authorized workflows exist; unknown workflow is denied.
- Capability grants per workflow; deny by default.
- Approval state machine: draft or proposal is stored, never executed. High-risk actions
  require a separate approval record and, later, re-authentication.
- Policy engine evaluated as deterministic code before generation and before execution.
- Untrusted content is treated as data, never as instructions.
- Append-only, hash-chained audit log with verification.
- Hive key only from environment or a server-side secret; never in the browser or logs.

### 3.3 Approval matrix (draft, pending owner confirmation)

| Action | Approval required | Re-auth | Phase enabled |
|---|---|---|---|
| Research / analysis | Workflow authorization | No | Phase 1 local |
| Recommendations | Workflow authorization | No | Phase 1 local |
| Draft content | Per-request approval | No | Phase 3, not enabled |
| Edit draft | Per-request approval | No | Phase 4, not enabled |
| Schedule | Per-item approval | Yes | Not enabled |
| Send email | Per-item approval | Yes | Not enabled |
| Publish website | Per-item approval | Yes | Not enabled |
| Change booking | Per-item approval | Yes | Not enabled |
| Charge customer | Per-item approval | Yes | Not enabled |
| Edit brand config | Owner action only | Yes | Phase 1 local |

Approval of one row does not authorize any other row.

---

## 4. Target architecture (recommended, not yet built)

```
Owner browser (Cloudflare Access, MFA)
        |
        v
PURPOSE dashboard on Cloudflare Pages (static, no secrets)
        |
        v
PURPOSE API on Cloudflare Workers
  - policy engine, workflow registry, approval state machine
  - audit writer, usage ledger, rate limits
  - Hive AI adapter (secret only in Worker)
  - GitHub adapter opens draft PRs only, cannot merge or deploy
  - read-only analytics adapters (Search Console, GA4, revenue)
        |
        +--> D1: config versions, directives, approvals, audit, usage
        +--> R2: artifacts, snapshots, immutable audit exports
        +--> Hive AI API
        +--> Owner-approved external services (draft or read-only)
```

Public visitor chatbot, if ever approved, runs as a separate route and Worker with no
admin tools, an owner-approved knowledge base, Turnstile, rate limits, and a safety
escalation path. It is deferred.

### 4.1 Preserved boundaries

- Static site stays on GitHub Pages at the existing domain.
- Admin surface is on a separate origin, never mixed into the public site.
- No Hive key in HTML, client JavaScript, or this repository.
- Website changes, if ever enabled, become draft pull requests against a working branch;
  merge and deploy remain owner actions.

---

## 5. Integration plan (planned, inactive)

| Capability | Candidate | Status | Activation gate |
|---|---|---|---|
| Memberships / subscriptions | Stripe Billing or equivalent | Not configured | Owner approval + tax/legal review |
| Digital product sales | Stripe Checkout, Gumroad, or Lemon Squeezy | Not configured | Owner approval + product readiness |
| Services / bookings | Cal.com | Not configured | Owner approval |
| Newsletter | MailerLite | Form exists but unconfigured | Owner approval + consent review |
| Revenue reporting | Provider APIs, read-only | Not configured | Owner approval |
| Website editing | GitHub draft PR | Not configured | Owner approval + Phase 4 |
| Public chatbot | Separate Worker | Deferred | Separate explicit approval |

No payment, subscription, membership, or customer-account capability may be activated
until the owner explicitly approves it and the approval matrix is updated.

---

## 6. Cost posture (free-first)

| Component | Choice | Expected cost at owner-only volume |
|---|---|---|
| Public site | GitHub Pages | $0 |
| Dashboard | Cloudflare Pages | $0 |
| API | Cloudflare Workers | $0 within free limits; ~$5/mo paid plan if exceeded |
| Database | Cloudflare D1 | $0 at this scale |
| Artifacts | Cloudflare R2 | Near $0 |
| Owner login | Cloudflare Access | $0 |
| Bot protection | Turnstile | $0 |
| AI | Hive AI, usage-based | DeepSeek V4.1 Flash: $0.10 per 1M input, $0.35 per 1M output |
| Local development | Node.js only, zero dependencies | $0 |

Hive production-use terms and account rate limits remain unverified and must be confirmed
by the owner in the Hive account before Phase 3.

---

## 7. Phase plan

| Phase | Scope | Gate |
|---|---|---|
| 0 | This baseline, governance model, cost and integration plan | Owner review of this document |
| 1 | Local PURPOSE foundation: config registry, inventory, directive validation, approval state machine, hash-chained audit, guarded Hive adapter, CLI, tests | Local tests pass; no network side effects |
| 2 | Private dashboard shell and owner authentication on Cloudflare | Owner reviews deployed auth |
| 3 | Hive workflow runner for research and recommendation only | Owner reviews sample runs |
| 4 | Review and approval UI for drafts | Proof drafts cannot execute sides effects |
| 5 | Read-only SEO and revenue analytics | Owner approves each data connection |
| 6 | Optional integrations, one at a time | Separate approval per integration |
| 7 | Public chatbot, if approved | Explicit go/no-go |
| 8 | Hardening, tests, secret scanning, cost alerts, runbook | Security review |
| 9 | Promotion to the live site | Final owner approval |

No phase may skip its gate. Phase 1 performs no publishing, sending, charging, booking, or
live-site modification.

---

## 8. Open owner decisions

1. Branch reconciliation for `develop-ai-studio` (rebase from `origin/main`? keep as
   research-only branch? create a new branch?).
2. Owner identity/provider for Cloudflare Access.
3. Supply approved brand voice, tone, audience, required disclaimers, banned claims,
   channel list, and approval matrix. Until supplied, these are `NEEDS OWNER REVIEW`.
4. Confirm which analytics and revenue sources are in scope and read-only.
5. Decide whether production defects in section 2.5 should be fixed later under a separate
   approved task.
6. Confirm Hive plan, rate limits, and production-use terms.
7. Confirm the canonical contact email and canonical social profile URLs.

---

## 9. Phase 1 deliverables

- `purpose/` local application, zero production dependencies.
- Owner instruction validation with clarification on missing or conflicting input.
- Brand standards registry with explicit `NEEDS OWNER REVIEW` markers.
- Digital product, article/page, link, asset, and revenue inventory.
- Approval state machine with pending/approved/rejected states.
- Append-only hash-chained audit log with tamper detection.
- Hive adapter disabled by default, requiring environment opt-in and an approved request.
- CLI: `status`, `workflows`, `gaps`, `inventory`, `intent`, `approve`, `reject`,
  `approvals`, `audit`, `draft`.
- Automated tests using the Node.js built-in test runner.
