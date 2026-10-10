# SEO, GEO & AI search visibility — PetPal Care Hub

Production: **https://petpal.com.cy/**  
Stack: Create React App (client-rendered) + Express static serve (`tracker-tcp-server`).

## What is configured in the repo

| File | Purpose |
|------|---------|
| `petpal/public/index.html` | Default title, description, OG, Organization/WebSite JSON-LD, crawler noscript |
| `petpal/public/sitemap.xml` | Canonical public URLs |
| `petpal/public/robots.txt` | Crawl rules + `OAI-SearchBot` + Sitemap |
| `petpal/src/config/seo.js` | Per-route titles, descriptions, robots, Product/Org JSON-LD |
| `petpal/src/components/RouteSeo.js` | Applies head tags on route change |
| `tracker-tcp-server/src/index.js` | Serves `/robots.txt` and `/sitemap.xml` as real files (not SPA HTML) |
| `petpal/scripts/seo-validate.cjs` | Offline sitemap/robots/SEO checks |
| `docs/SEO_ROUTE_INVENTORY_BEFORE.md` / `AFTER.md` | Route preservation proof |

## Indexable vs private

**Indexed (public hubs):** `/`, `/shop`, `/shop/nfc`, `/nearby`, `/lost-pet`, `/contact`, `/install`, `/docs`, `/discover`, legal pages, `/pet/:id`

**Not indexed:** `/admin/*`, `/dashboard`, `/tracking`, `/profile`, `/bookings`, `/pets`, `/premium`, `/shelters`, `/shop/checkout`, `/lost-pet/:id`, auth screens, etc.

**Note:** Language is client-side (EN/EL/RU) without localized URL paths — do not invent `/el/...` duplicates.

## GPTBot vs OAI-SearchBot

- **OAI-SearchBot** — ChatGPT *Search* discovery. Allowed in `robots.txt` with the same Disallow list as `*`.
- **GPTBot** — model-training crawler. **Not configured** (left as default / unspecified). Changing GPTBot is a separate policy decision.

## Analytics

Optional Firebase Analytics via cookie consent (`CookieConsent` + `REACT_APP_FIREBASE_MEASUREMENT_ID`). Do not add a second GA/GTM tag without reviewing consent.

## Manual production checklist (after deploy)

1. Confirm `https://petpal.com.cy/sitemap.xml` is XML (not HTML).
2. Confirm `https://petpal.com.cy/robots.txt` allows `/nearby` and `/shop/nfc`.
3. Google Search Console → resubmit `sitemap.xml` → URL Inspection for `/`, `/shop`, `/shop/nfc`.
4. Bing Webmaster Tools → submit sitemap.
5. Cloudflare: purge cache if old HTML sitemap was cached.
6. Optional: Google Business Profile — see `GOOGLE_BUSINESS_PROFILE.md`.

## AI visibility spot-check (manual, monthly)

Ask ChatGPT Search / Perplexity / Bing Copilot / Gemini:

1. What is a good GPS tracker for dogs in Cyprus?
2. Where can I buy a GPS tracker for cats in Cyprus?
3. What is the difference between PetPal GPS trackers and NFC tags?
4. Which pet GPS trackers are available in Cyprus?

Record: whether PetPal is mentioned, whether petpal.com.cy is cited, and which alternatives appear. Results are not guaranteed.

## Validation

```bash
cd petpal
node scripts/seo-validate.cjs
CI=true npm test -- --watchAll=false src/config/seo.test.js
npm run build
```
