# OPWP — Integration Checklist (draft for owner approval)

Owner directive Nov 7, 2026: settle integrations and complete the checklist
within 3 days (by Mon Nov 9, 2026, assuming work starts today). Statuses use
the owner's own inventory.

## Current integrations (owner inventory)
| Integration | Role | Status now |
|---|---|---|
| GitHub | Stores website + PURPOSE code | In use |
| GitHub Pages | Hosts the public site | Recorded hosting setup |
| Calendly | Free 30-minute consultations | Connected to website |
| FormSubmit | Delivers contact-form mail | Delivery confirmed; automatic reply unresolved |
| Outlook | Receives forwarded branded email | In use |
| Ko-fi | Support, tips, potential sales/memberships | Setup underway; payment connection + URL unverified |

## DAY 1 — lock and ship what is already built
- [ ] Owner reviews local preview; approves batch (site rebuild, fonts, gold, Circle of Purpose, tier prices/billing/7-day trial)
- [ ] Agent: commit + push develop-ai-studio, merge to main (site live update)
- [ ] Agent: verify Pages deployment finished; owner hard-refreshes live site
- [ ] Owner: FormSubmit — submit any form once and click the activation email (unblocks automatic replies)
- [ ] Owner: reply to FormSubmit autoresponse question with yes/no (branded thank-you email) → agent applies
- [ ] Agent: extract PayPal sandbox zip into repo `checkout/` (local-only, not deployed) and run its 11 tests

## DAY 2 — finish payments
- [ ] Owner: create Stripe account (if not done) and make 6 Payment Links: Rooted $4.99/mo, Rising $9.99/mo, Unshakeable $14.99/mo + annual $59.88/$119.88/$179.88, each with a 7-day free trial
- [ ] Owner: paste the 6 links here; agent wires them into the community.html tier buttons (removes placeholders) and publishes
- [ ] Owner: decide Ko-fi — strips in as tips/support only, or parked (memberships live on Stripe)
- [ ] Owner: send the final Ko-fi page URL; agent replaces the generic https://ko-fi.com links sitewide
- [ ] Owner: confirm monthly vs monthly+annual PayPal scope is sandbox-only for now (no live PayPal until owner approves)

## DAY 3 — brand links + closeout
- [ ] Owner: sends real social profile URLs (Facebook, YouTube, Instagram, TikTok, LinkedIn); agent replaces the placeholder facebook.com/youtube.com links sitewide
- [ ] Owner: confirms Outlook branded addresses in use on the site (shrondajeanine@on-purpose-with-purpose.org + outlook.com) are the ones they want public — agent aligns if not
- [ ] Agent: fills the Stripe placeholder story (buttons real, no data-placeholder left), sitemap ping, robots check
- [ ] Agent: final cross-page consistency pass (fonts, gold, tagline, contact info — per Brand Protocol Rule 5)
- [ ] Agent: adds dated change-log entries + version (per Rule 7/8) to the OneDrive change log
- [ ] Owner: final review of live site; any leftovers go to a new list

## Waiting on owner (blocked until answered)
1. Batch approval to commit + publish
2. FormSubmit activation click + autoresponse decision
3. Stripe account + 6 Payment Link URLs
4. Ko-fi decision + page URL
5. Social profile URLs
6. PayPal sandbox storage location answer (repo `checkout/` vs Desktop only)

## NOT in scope until separately approved (per Rule 1)
New products, new pages/features, license review of remaining remote images
(nappy.co tiles), PURPOSE deployment, live.html reintroduction.
