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

- **THE PURPOSE NETWORK Brand Protocol (owner-mandated)**: The owner-supplied
  "Brand Consistency, Approval, Learning & Change Management Protocol" governs
  all work: no unapproved changes/renames/additions (present ideas as labeled
  suggestions, never implement unasked); complete the current request and let
  the owner review before anything else; every approved decision becomes part
  of project memory; voice = hope/growth/healing/community-centered
  (never shame-, guilt-, or fear-based); site/newsletter consistency checks;
  running change log (Added/Modified/Removed/Pending Approval/Notes) — nothing
  logged until approved; numbered versions with date/changes/author/approval;
  documents as Markdown + PDF; workflow = draft → present → review → revise →
  approval → log → new version. Owner decisions are the source of truth.
- **Newsletter: Listmonk SET ASIDE (owner directive, Nov 2026)**: do not
  configure, install, or plan Listmonk hosting unless the owner reopens it.
  Site email capture continues via FormSubmit; Buttondown stays parked.
- **Booking calendar (Nov 2026)**: three approved Calendly meeting types —
  Community Check-In (30 min, any day, never limited to Wednesdays; described
  as supportive conversations, NEVER therapy/clinical wording), Podcast /
  Content Guest Interview (60 min), Collaboration & Partnership (60 min).
  Zoom and Microsoft Teams both offered. Site wiring waits for the owner's
  Calendly event URLs.
- **Calendly + PayPal (owner decisions, Nov 7 2026)**: PayPal is connected to
  Calendly (account 87XYZMGWBF9N6); all payments go directly to the owner's
  PayPal account. Event types (owner renames, Nov 7 2026): "Let's Talk"
  (30 min, phone, one-on-one; the free initial conversation — private
  sessions, groups, workshops are booked from there later), "Purpose &
  Perspective" (45 min, Google Meet, group; formerly Podcast / Content Guest
  Interview), "Creative Connection" (60 min, Google Meet, group; formerly
  Collaboration & Partnership). Purpose & Perspective rename/price decision
  parked on the comeback list. Current URLs:
  - Let's Talk: https://calendly.com/shrondajeanine79/30min
  - Purpose & Perspective: https://calendly.com/shrondajeanine79/podcast-content-guest-interview
  - Creative Connection: https://calendly.com/shrondajeanine79/collaboration-partnership
  (URLs kept their original slugs after renaming — verified live Nov 7 2026.)
- **3-page website (owner-locked, Nov 2026)**: the public site stays no more
  than 3 pages — Home (`index.html`), Community (Circle of Purpose +
  memberships), and Wellness. Shop and Connect are noindex redirect stubs
  (shop → community memberships; connect → index contact). Every nav location
  across the three live pages matches; do not add new public pages.
- **Circle of Purpose (owner-approved, Nov 2026)**: the official membership
  community of On Purpose With Purpose. Tiers locked: Rooted in Purpose (5
  benefits), Rising in Purpose (7), Unshakeable Purpose (10) — exact benefit
  lists live in `docs/circle-of-purpose.md` and must not be invented/renamed.
  One logo only (the purple-gradient emblem) — membership materials build from
  it. Tier accents: gold+green (Rooted), gold+teal (Rising), premium gold
  (Unshakeable). Pricing owner-set (Nov 2026): $4.99 / $9.99 / $14.99 monthly with annual options at 12x pricing and a 7-day free trial on every plan; no Stripe products/subscriptions/links
  without explicit owner approval — keep the placeholders.
- **Consultation note (internal only, not on site)**: one free 30-minute
  introductory consultation per person; later paid appointments are arranged
  personally with Shronda — never publish that sentence on public pages.
- **Locked gold (owner, Nov 2026)**: the official gold is the purple-gradient
  logo's gold (measured ≈ `#E79F0C`, darker stop `#C98206`), used with a
  shimmering sweep for ALL gold accents site-wide. Do not reintroduce the old
  bright `#E9C46A` or the kit proposal `#C9A24B`.
- **Locked tagline**: "Made with intention. Rooted in growth. Always evolving"
  (owner-approved, footer of every page). Do not alter it unless the owner
  explicitly asks.
- **Permission Slips is fully retired** from the website (workshop feature
  removed by owner decision). Do not re-add it, its `slips.jpg` asset, or
  `#permission-slips` links/sections. `live.html` is also retired. The memberships
  feature (Rooted Rising Unshakeable tiers, `community.html#memberships`, Stripe
  Payment Link placeholders) replaces it.

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
