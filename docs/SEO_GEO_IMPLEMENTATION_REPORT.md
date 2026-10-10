# PetPal Care Hub — SEO / GEO implementation report

Date: 2026-10-10  
Domain: https://petpal.com.cy/  
Constraint honored: **no page renames, URL changes, nav label changes, or new routes.**

---

## A. Initial audit

| Finding | Evidence |
|---------|----------|
| CRA SPA — thin HTML for crawlers | Production HTML is shell + noscript; product copy mostly client-rendered |
| Sitemap served correctly as XML | `curl` → `application/xml`, 9 URLs |
| robots Disallowed `/nearby` while app SEO marked it indexable | `public/robots.txt` vs `seo.js` conflict |
| `/shop/nfc` existed but was noindex + absent from sitemap | `resolveSeo` `/shop/*` rule; sitemap lacked loc |
| `/lost-pet` public hub was blanket noindex | `NOINDEX_PREFIXES` included `/lost-pet` |
| Home meta/JSON-LD already present | `index.html` + `RouteSeo` |
| Product schema missing | No Product JSON-LD before this change |
| AI search crawler not mentioned | No `OAI-SearchBot` block |
| Analytics optional via consent | Firebase measurement + CookieConsent already exist |
| Firebase Hosting unused for SPA | App served by Express/Cloudflare; `firebase.json` has no hosting block |

Historical GSC “9 discovered / 1 indexed” is consistent with thin SPA + prior sitemap HTML issue (documented in older `SEO.md`). Not re-verified in GSC from this environment.

---

## B. Implemented changes (files)

### Created
- `docs/SEO_ROUTE_INVENTORY_BEFORE.md`
- `docs/SEO_ROUTE_INVENTORY_AFTER.md`
- `docs/SEO_GEO_IMPLEMENTATION_REPORT.md` (this file)
- `petpal/scripts/seo-validate.cjs`
- `petpal/src/config/seo.test.js`

### Modified
- `petpal/public/robots.txt` — allow Nearby; Disallow shelters; OAI-SearchBot; comments for GPTBot
- `petpal/public/sitemap.xml` — add `/shop/nfc`, `/nearby`, `/lost-pet`; refresh lastmod
- `petpal/public/index.html` — meta, richer Organization JSON-LD, noscript product facts + links
- `petpal/src/config/seo.js` — route SEO, Product/WebPage JSON-LD, index policy
- `petpal/src/components/RouteSeo.js` — `og:locale`
- `petpal/src/Pages/Shop.js` — H1/lead + GPS facts section (existing design classes)
- `petpal/src/Pages/ShopNfc.js` — how-it-works + NFC vs GPS section
- `petpal/src/Pages/Nearby.js` — H1 + lead (existing page header pattern)
- `petpal/src/Pages/LostPetAlerts.js` — factual how-it-works sentence
- `petpal/src/shop/catalog.js` — product subtitle fallbacks (accurate)
- `petpal/src/i18n/locales/en.js`, `el.js`, `ru.js` — SEO copy keys only
- `docs/SEO.md` — updated runbook

### Not changed
- All route paths, nav labels, Firebase/Cloudflare production config, payments, auth

---

## C. SEO improvements

- Unique titles/descriptions for `/`, `/shop`, `/shop/nfc`, `/nearby`, `/lost-pet`, legal/help
- Absolute canonicals via `RouteSeo`
- Sitemap = indexable public hubs only
- Product JSON-LD prices derived from `catalog.js` (not hardcoded orphans)
- Internal links: shop ↔ NFC; noscript links to shop/nfc/nearby/lost-pet
- Heading hierarchy: H1 on Shop, Nearby; H2 for SEO fact sections

---

## D. AI crawler readiness

| Item | Status |
|------|--------|
| OAI-SearchBot Allow with private Disallows | Implemented in repo |
| GPTBot policy | Unchanged (documented) |
| Public HTML facts in noscript | Implemented |
| Cloudflare bot challenges | Needs production verification (no infra change) |
| ChatGPT/Perplexity citations | Not guaranteed; spot-check procedure in `SEO.md` |

---

## E. Route preservation verification

See before/after inventories. **All existing paths and nav labels unchanged.** Only indexing policy and on-page/meta copy improved.

---

## F. Test results

| Check | Result |
|-------|--------|
| `node scripts/seo-validate.cjs` | **Passed** (sitemap, robots, OAI-SearchBot, JSON-LD presence, title uniqueness) |
| `CI=true npx react-scripts test --watchAll=false src/config/seo.test.js` | **Passed** (8 tests) |
| `npm run build` | **Passed** |
| Lint / full suite | Not run site-wide (existing CRA warnings elsewhere pre-exist) |
| Live GSC / Cloudflare crawler check | **Not performed** (requires production + external tools) |
| Google Rich Results Test | **Not performed** (post-deploy) |

---

## G. Remaining external actions

1. Deploy this branch (user/ops — not done by this agent per instructions).
2. Google Search Console: resubmit sitemap; request indexing for `/`, `/shop`, `/shop/nfc`, `/nearby`, `/lost-pet`.
3. Bing Webmaster Tools: submit sitemap.
4. Cloudflare: purge cache if needed after deploy.
5. Confirm no WAF rule blocks `OAI-SearchBot` / Bingbot.
6. Optional: Google Business Profile; outreach (section H).

### Safari “plain text” sitemap display (follow-up)

**Root cause:** The live sitemap was already valid XML (`application/xml` with `<urlset>` / `<url>` / `<loc>`). iOS Safari/WebKit hides XML tags and shows only text nodes, which looks like concatenated plain text.

**Fix in repo:** `xml-stylesheet` → `/sitemap.xsl` plus explicit Content-Type on the Express SEO file routes. After deploy, Safari should show an HTML table; crawlers still parse the raw XML.

---

## H. Prioritized next steps

1. Deploy + GSC/Bing sitemap resubmit.
2. Monitor Coverage for the newly allowed URLs (`/nearby`, `/shop/nfc`, `/lost-pet`).
3. Monthly AI visibility spot-check (questions in `SEO.md`).
4. Genuine Cyprus outreach: vets, pet shops, shelters, reviews (no purchased links).
5. If indexing remains weak: consider **approved** prerender for `/` and `/shop` only (would need explicit approval — architectural).
6. Supply any missing legal/shipping text if checkout needs clearer public policy pages (do not invent).

### New-page opportunities (approval required — not created)

- Dedicated editorial FAQ/guide pages beyond existing `/docs` — only if product marketing wants them.
- Localized URL trees (`/el/...`) — not recommended without a full i18n routing project.
