# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

Official website for **On Purpose With Purpose** — an earthy, celestial personal
growth brand (community, creative content, digital products, memberships).

- Static GitHub Pages site with custom domain `on-purpose-with-purpose.org` (CNAME).
- Branch discipline: `develop-ai-studio` is the active development branch. Do not
  touch `main` or the live site without explicit owner approval.
- Local domain: nothing is deployed or published without closing owner review.

## Repository layout

- `index.html`, `*.html` — public static pages (about, community, connect,
  contact, live, shop, wellness, permission-slips, free-guide, 404).
- `css/style.css`, `assets/css/*.css` — styles; established cream/teal/purple/gold
  palette, skip link, mobile nav, reduced-motion support.
- `js/site.js`, `assets/js/main.js` — site JavaScript.
- `images/`, `ONPWPIMAGES/` — site imagery.
- `docs/` — brand service inventory, phase plans, architecture notes.
- `WEBSITE_AUDIT.md` — review-only improvement plan (approval before implementation).
- `purpose/` — PURPOSE, a private, owner-directed AI Brand Guru (Node ≥20, no
  third-party dependencies). Local Phase 1 foundation; nothing deployed. Has its
  own README, `.env.example`, migrations, tests, and a local browser dashboard
  (Node ≥22.13). Run its commands from within `purpose/`.

## Commands

- Static site: plain HTML/CSS/JS — no build step. Open pages directly or preview
  with any static server.
- PURPOSE tests (run inside `purpose/`): `node --test` (watch: `npm run test:watch`).
- PURPOSE CLI: `node bin/purpose.js help` (status, workflows, approvals, audit, etc.).
- PURPOSE dashboard: `npm run dashboard` (inside `purpose/`).

## Conventions and rules

- **Secrets**: never add, echo, or commit `.env`, `.env.txt`, or API keys. Env
  files are gitignored (`.env.example` is the tracked template). Hive AI keys are
  server-side only — never place a Hive secret in HTML or client JavaScript.
- **Design**: keep the existing cream/teal/purple/gold palette, semantic HTML,
  skip link, and reduced-motion support. Do not delete CSS classes until verified
  against actual rendering (e.g., `.moon-art` vs `.hero-moon`).
- **Accessibility**: keep mobile menu keyboard-accessible (Escape/outside-click
  close, focus restoration); test narrow phones before merging.
- **Content**: do not present placeholder articles as published; newsletter
  signup is not configured — route inquiries to the contact form.
- **External images**: Pexels/Unsplash sources need license verification; prefer
  locally hosted optimized assets.
- **PURPOSE scope**: acts only on explicit owner directives with policy enforced
  in code. Not a public builder, SaaS, or autonomous content creator. AI runs
  require confirmation before execution.
- No third-party runtime dependencies in `purpose/`; Node built-ins only.
- Windows environment: use PowerShell-safe paths and quoting when running commands.
