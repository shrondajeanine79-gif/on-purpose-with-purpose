# Website audit and proposed improvements

Prepared October 23, 2026. **Review only — no production website changes.**

## Existing foundation
- Static GitHub Pages site with custom domain `on-purpose-with-purpose.org` (CNAME).
- Homepage: `index.html`; stylesheet: `assets/css/style.css`; JavaScript: `assets/js/main.js`.
- Established cream/teal/purple/gold design, semantic sections, skip link, mobile navigation, reduced-motion media query.

## Recommended changes (approval before implementation)
1. **Make The Journal useful.** Current `#journal` is a single reflective prompt rather than an article library. Add a curated articles/resources section with working links; don't present placeholder articles as published.
2. **Clarify Stay Connected.** Current `#connect` has a `mailto:` link, not newsletter registration. Keep the contact link and add a newsletter form only after a consent-aware service or storage destination is selected.
3. **Improve social previews.** Add a branded `og:image`, `og:url`, and appropriate Twitter/X card metadata, after preparing a correctly sized owned image.
4. **Check styling for the hero and missing component styles.** Styles for `.moon-art` exist but the homepage uses `.hero-moon` and `.hero-visual`; review these against actual browser rendering. Do not delete classes until checked.
5. **Improve mobile menu accessibility.** Close on Escape and outside click, restore focus appropriately, and test keyboard navigation on mobile and desktop.
6. **Review external imagery.** Hero and section images load from Pexels with Unsplash fallbacks. Verify image availability, licensing/attribution requirements, and layout stability; consider locally hosted optimized assets.
7. **Verify responsiveness and performance.** Test narrow phones, tablet, desktop, accessibility, loading, and link behavior before merging.
8. **Plan AI integration securely.** GitHub Pages is static: never place a Hive secret in HTML or client JavaScript. Use a server-side endpoint with secret storage, rate limits, abuse prevention, and a spend cap before enabling public generation.

## Suggested implementation sequence
- Phase A: navigation/accessibility, image/metadata improvements, verified visual fixes.
- Phase B: journal articles/resources and an intentional email signup.
- Phase C: Purpose Reflection & Affirmation Generator prototype, behind a secure API and budget controls.

## Review safeguards
- This branch does not modify `main` or the live site.
- Confirm content, design, and any external service choices before implementation.
- Keep the IONOS domain and GitHub Pages hosting.
