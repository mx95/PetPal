# SEO & Google Search indexing

PetPal is a **Create React App** SPA served by the Express tracker (`tracker-tcp-server`) behind nginx — not Firebase Hosting.

Google can index the site, but indexing is **not instant**. After deploy you must ask Google to recrawl; local build success does not mean Search Console is fixed.

## What is configured in the repo

| File | Purpose |
|------|---------|
| `petpal/public/index.html` | Default homepage title, description, Open Graph, JSON-LD, noscript |
| `petpal/src/config/seo-meta.json` | Shared per-route titles, descriptions, crawl HTML, sitemap flags |
| `petpal/src/config/seo.js` | Client `resolveSeo()` + JSON-LD helpers |
| `petpal/src/components/RouteSeo.js` | Updates head tags on client navigation |
| `petpal/public/sitemap.xml` | Canonical **index-worthy** public URLs only |
| `petpal/public/robots.txt` | Allows public pages; blocks private app areas |
| `tracker-tcp-server/src/seoSpaInject.js` | **Server** per-route meta/canonical/robots + crawl HTML injection |
| `tracker-tcp-server/src/index.js` | `/robots.txt`, `/sitemap.xml`, www→apex, trailing-slash redirects |

### Critical SPA fix

Without server injection, every URL returned the **same** homepage `<title>` / canonical until JavaScript ran. Express now rewrites those tags from `seo-meta.json` based on `req.path`.

## Canonical domain

Preferred host: **`https://petpal.com.cy`** (non-www).

- Express 301-redirects `www.petpal.com.cy` → apex
- nginx setup script should also redirect www (re-run `scripts/setup-nginx-domain.sh` on the server if needed)
- Trailing slashes on HTML routes 301 to the non-slash form
- `/index.html` 301 → `/`

## Sitemap policy (fewer, higher-quality URLs)

**Included:** `/`, `/shop`, `/discover`, `/contact`, `/docs`, plus SEO landings:
`/nfc-pet-tags`, `/gps-pet-trackers`, `/lost-pet-safety`, `/pet-friendly-places`

**Excluded on purpose:** `/privacy`, `/terms`, `/cookies` (accessible, `noindex`), `/install` (utility), app-only routes, redirecting URLs.

## After deploy — Search Console

1. Confirm:
   - `https://petpal.com.cy/robots.txt` → 200, allows `/`, lists Sitemap
   - `https://petpal.com.cy/sitemap.xml` → XML (not HTML)
   - `curl -s https://petpal.com.cy/shop | grep canonical` → `https://petpal.com.cy/shop`
2. **Sitemaps** → resubmit `sitemap.xml` (or wait for Google to refresh)
3. **URL inspection** → Request indexing for `/`, `/shop`, `/discover`, and new landings
4. Expect **days to weeks** for “Discovered – currently not indexed” to shrink — Google still decides what to index
5. Optional: Cloudflare → Purge cache once after deploy

## Production env (before `npm run build`)

```bash
REACT_APP_SITE_URL=https://petpal.com.cy
```

## Indexable vs private

**Indexable (public marketing):** `/`, `/shop`, `/discover`, SEO landings, `/contact`, `/docs`

**noindex / robots Disallow:** `/admin`, `/dashboard`, `/tracking`, `/nearby` (use `/pet-friendly-places` for SEO), `/profile`, bookings, checkout, etc.

**Accessible but not promoted:** legal pages (`noindex` + out of sitemap)
