# DEVELOPMENT INVENTORY — The Purpose Network

_Snapshot generated 2026-11-02 at migration time. See the post-migration update below for the owner-approved cleanup and current Git state._

## Post-migration update (2026-11-02)

- Local cleanup commit created on `develop-ai-studio`; the commits were pushed to origin on 2026-11-02.
- `.env` and `.env.txt` were removed from the current index and `.gitignore` now excludes them.
- `opencode.json.backup` and the unused duplicate `images/SITE.jpg` were removed.
- The 36 CRLF-only working-tree changes were normalized to LF; no substantive site content changed.
- Node.js v22.23.4 was installed via nvm; `npm test` passes 164/164.
- The working tree is clean and the branch is up to date with `origin/develop-ai-studio`.
- The old `.env.txt` values remain in public Git history; the owner reports the credentials were rotated. No history purge was performed.

## Overview

| Field | Value |
|---|---|
| Project | The Purpose Network |
| Purpose | Official On Purpose With Purpose public website, plus the private local PURPOSE assistant/dashboard maintained on the develop-ai-studio branch. |
| GitHub | https://github.com/shrondajeanine79-gif/on-purpose-with-purpose.git |
| Visibility | PUBLIC |
| Local path | /home/shr/Projects/03-WEBSITES/The-Purpose-Network |
| Active branch | develop-ai-studio |
| Local commit | `6f213d1` (6f213d1a764f9270783a2ae43f6856508bb8d5d7) |
| Upstream | origin/develop-ai-studio |
| Remote commit | `6f213d1` (6f213d1a764f9270783a2ae43f6856508bb8d5d7) |
| Synchronization | Up to date with origin/develop-ai-studio |
| Working tree | 40 changed/untracked entries |
| Git history | Preserved in local `.git` |

## Build / Test / Run

The public site is static HTML/CSS/JS with no build step:

```bash
cd /home/shr/Projects/03-WEBSITES/The-Purpose-Network
python3 -m http.server 8000     # then open http://localhost:8000
```

PURPOSE (private local foundation, not deployed):

```bash
cd purpose
npm test                        # Node built-in test runner
node bin/purpose.js help
node bin/purpose.js status
npm run dashboard               # local dashboard, 127.0.0.1:8788
```

Requirements: Node.js 20+ (dashboard needs 22.13+), no third-party npm dependencies. Node.js v22.23.4 is installed in WSL via nvm.

## Configuration & environment files

| File | Tracked? | Notes |
|---|---|---|
| `.env` | no (ignored; staged for deletion) | Local, empty. Must never be committed. |
| `.env.txt` | no (ignored; staged for deletion) | Local. Variable names only: `FLASK_SECRET_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`. |
| `purpose/.env.example` | yes | Template; no real values. |
| `purpose/config/*.json` | yes | Brand, governance, inventory configuration. No secret values. |
| `purpose/.data/` | no (ignored) | Local dashboard database, approvals, audit log. Not committed. |

Other referenced variables (from source): `HIVE_API_KEY`, `PURPOSE_DB_PATH`, `PURPOSE_DATA_DIR`, `PURPOSE_DASHBOARD_PORT`, `PORT`.

## Important files

- `index.html` — public home page.
- `about.html`, `community.html`, `connect.html`, `contact.html`, `free-guide.html`, `live.html`, `permission-slips.html`, `shop.html`, `wellness.html`, `404.html` — public pages.
- `assets/css/`, `assets/js/` — current site styles/scripts.
- `css/style.css`, `js/site.js` — older/alternate style layer (not identical to `assets/`).
- `ONPWPIMAGES/`, `images/` — site imagery.
- `purpose/` — private PURPOSE assistant (CLI, local API, dashboard, tests, migrations).
- `docs/` — brand/service inventory and phase plans.
- `CNAME`, `.nojekyll` — GitHub Pages hosting metadata.

## Duplicates / potentially obsolete files

- Resolved during cleanup: `opencode.json.backup` and the unused duplicate `images/SITE.jpg` were removed. `ONPWPIMAGES/SITE.jpg` remains and is referenced by `ONPWPIMAGES/desktop.ini`.
- `assets/css/style.css` and `css/style.css` are **different** files (different generations), not duplicates.
- `assets/js/main.js` and `js/site.js` serve different layers; both are referenced by different pages — verify before removing.
- Windows metadata: `ONPWPIMAGES/desktop.ini`.
- `purpose/.data/` holds local runtime state; keep unless history is intentionally discarded.

## Missing files / dependencies

- Node.js is not installed in WSL, so PURPOSE tests/dashboard cannot run until installed.
- No `package-lock.json` (project has zero npm dependencies, so this is expected).
- Newsletter provider intentionally not configured (see `README.md`).
- No deployment performed during this migration.

## Security notes

- `.env` / `.env.txt` were **present in Git history** (one historical commit) and the current commit removes them from the index. The owner reports the exposed credentials were rotated. The repository is public; a history purge still requires explicit owner approval.
- File permissions of the local copies were tightened to `600`.
- Generations of Purpose is private and unaffected by this repository.
## Directory tree

```text
.
|-- .env
|-- .env.txt
|-- .gitignore
|-- .nojekyll
|-- 404.html
|-- CNAME
|-- DEVELOPMENT-INVENTORY.md
|-- ONPWPIMAGES
|   |-- GOODONE.jpg
|   |-- INCLUSIVE.jpg
|   |-- MEDITATE1.jpg
|   |-- RELAX.jpg
|   |-- RESTORE.jpg
|   |-- SITE.jpg
|   |-- WELLNESS.jpg
|   |-- balance.jpg
|   |-- blm2026site.jpg
|   |-- community.jpg
|   |-- contactus.jpg
|   |-- desktop.ini
|   |-- file_000000000b4471f5907d2102a2228844.png
|   |-- file_000000004724722f832244e1cf6a1ec5.png
|   |-- holisticus.jpg
|   |-- meditate.jpg
|   |-- nature.jpg
|   `-- on_purpose_thumbnail_1280x720.jpg
|-- README.md
|-- WEBSITE_AUDIT.md
|-- about.html
|-- assets
|   |-- css
|   |   |-- home.css
|   |   `-- style.css
|   `-- js
|       `-- main.js
|-- community.html
|-- connect.html
|-- contact.html
|-- css
|   `-- style.css
|-- docs
|   |-- Brand-Service-Inventory.md
|   |-- Brand-Service-Inventory.pdf
|   |-- PHASE-0-PLAN.md
|   `-- PHASE-2-ARCHITECTURE.md
|-- free-guide.html
|-- images
|   |-- SITE.jpg
|   |-- nappy-field.jpg
|   |-- nappy-garden.jpg
|   `-- shronda.jpg
|-- index.html
|-- js
|   `-- site.js
|-- live.html
|-- opencode.json
|-- opencode.json.backup
|-- permission-slips.html
|-- purpose
|   |-- .data
|   |   |-- Start-PURPOSE.vbs
|   |   |-- approvals.json
|   |   |-- audit.log.jsonl
|   |   |-- dashboard.db
|   |   `-- purpose.ico
|   |-- .env.example
|   |-- .gitignore
|   |-- README.md
|   |-- bin
|   |   `-- purpose.js
|   |-- config
|   |   |-- brand-standard.json
|   |   |-- governance.json
|   |   `-- inventory
|   |       |-- assets.json
|   |       |-- links.json
|   |       |-- pages.json
|   |       `-- products.json
|   |-- dashboard
|   |   |-- README.md
|   |   |-- app.js
|   |   |-- icon.svg
|   |   |-- index.html
|   |   `-- style.css
|   |-- examples
|   |   |-- ambiguous-scope.json
|   |   |-- blocked-publish.json
|   |   `-- read-only-audit.json
|   |-- install-dashboard.ps1
|   |-- migrations
|   |   `-- 0001_init.sql
|   |-- package.json
|   |-- src
|   |   |-- ai
|   |   |   |-- gateway.js
|   |   |   `-- stub.js
|   |   |-- api
|   |   |   `-- router.js
|   |   |-- audit.js
|   |   |-- auth
|   |   |   |-- access.js
|   |   |   `-- jwt.js
|   |   |-- brand.js
|   |   |-- budget.js
|   |   |-- config.js
|   |   |-- d1.js
|   |   |-- directive.js
|   |   |-- hash.js
|   |   |-- hive.js
|   |   |-- inventory-summary.js
|   |   |-- inventory.js
|   |   |-- local
|   |   |   |-- dashboard.js
|   |   |   |-- db.js
|   |   |   |-- dev-auth.js
|   |   |   |-- dry-run.js
|   |   |   `-- server.js
|   |   |-- policy.js
|   |   |-- store
|   |   |   |-- approvals.js
|   |   |   |-- audit-chain.js
|   |   |   |-- config.js
|   |   |   `-- directives.js
|   |   `-- usage.js
|   `-- test
|       |-- audit.test.js
|       |-- brand.test.js
|       |-- cli.test.js
|       |-- dashboard.test.js
|       |-- directive.test.js
|       |-- helpers
|       |   `-- jwt-mint.js
|       |-- hive.test.js
|       |-- phase2-auth.test.js
|       |-- phase2-budget.test.js
|       |-- phase2-isolation.test.js
|       |-- phase2-policy.test.js
|       |-- phase2-router.test.js
|       |-- phase2-schema.test.js
|       |-- phase2-store.test.js
|       `-- phase3-dry-run.test.js
|-- shop.html
`-- wellness.html

25 directories, 119 files
```

_Excluded from display: `.git` internals, IDE caches, dependency caches, build outputs. Secret values are never displayed._

## Uncommitted local work

```text
## develop-ai-studio...origin/develop-ai-studio
D  .env
D  .env.txt
M  .gitignore
 M 404.html
 M ONPWPIMAGES/desktop.ini
 M README.md
 M WEBSITE_AUDIT.md
 M about.html
 M assets/css/home.css
 M assets/css/style.css
 M assets/js/main.js
 M community.html
 M connect.html
 M contact.html
 M css/style.css
 M docs/Brand-Service-Inventory.md
 M free-guide.html
 M index.html
 M js/site.js
 M live.html
 M opencode.json
 M opencode.json.backup
 M permission-slips.html
 M purpose/README.md
 M purpose/config/governance.json
 M purpose/config/inventory/links.json
 M purpose/config/inventory/pages.json
 M purpose/dashboard/README.md
 M purpose/dashboard/app.js
 M purpose/dashboard/icon.svg
 M purpose/dashboard/index.html
 M purpose/dashboard/style.css
 M purpose/install-dashboard.ps1
 M purpose/package.json
 M purpose/src/local/dashboard.js
 M purpose/test/dashboard.test.js
 M purpose/test/phase2-router.test.js
 M shop.html
 M wellness.html
?? DEVELOPMENT-INVENTORY.md
```

