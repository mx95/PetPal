# SEO & Google Search indexing

PetPal is a client-rendered React app. Google can index it, but you must **submit the site manually** — it will not appear in search results until Google discovers and indexes it.

## What is configured in the repo

| File | Purpose |
|------|---------|
| `petpal/public/index.html` | Default title, description, Open Graph, JSON-LD |
| `petpal/public/sitemap.xml` | Public URLs for crawlers |
| `petpal/public/robots.txt` | Allows public pages; blocks `/admin`, `/dashboard`, etc. |
| `petpal/src/components/RouteSeo.js` | Per-route title, description, canonical, `noindex` |
| `petpal/src/config/seo.js` | Site URL and route SEO map |

## One-time setup (required)

### 1. Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console)
2. Add property: **URL prefix** → `https://petpal.com.cy`
3. Verify ownership (recommended: **DNS TXT record** at your domain registrar)
   - Alternative: set `REACT_APP_GOOGLE_SITE_VERIFICATION` in `petpal/.env.local`, rebuild, deploy
4. Go to **Sitemaps** → submit: `https://petpal.com.cy/sitemap.xml`
5. Use **URL inspection** on `/` and `/shop` → **Request indexing**

Indexing usually takes **several days to a few weeks** for a new site.

### 2. Pick one canonical domain

Use either `petpal.com.cy` or `www.petpal.com.cy` everywhere (Search Console, sitemap, links). Redirect the other to your chosen host in nginx to avoid duplicate listings.

### 3. Production env (before `npm run build`)

```bash
REACT_APP_SITE_URL=https://petpal.com.cy
# Optional, after Search Console setup:
REACT_APP_GOOGLE_SITE_VERIFICATION=your-code-here
```

### 4. Deploy and verify

After deploy, confirm these URLs work in a browser:

- `https://petpal.com.cy/robots.txt`
- `https://petpal.com.cy/sitemap.xml`

View page source on `/` — you should see the title, description, and JSON-LD block.

## Search terms

You will usually appear first for **brand searches** (`PetPal`, `PetPal Cyprus`, `petpal.com.cy`) before generic terms (`GPS pet tracker Cyprus`). Generic ranking needs content, backlinks, and time.

## Updating the sitemap

When you add new **public** marketing pages, add a `<url>` entry to `petpal/public/sitemap.xml` and redeploy. Then resubmit the sitemap in Search Console (or use “Ping” by visiting the sitemap URL after deploy).

## Indexable vs private routes

**Indexed (public):** `/`, `/shop`, `/contact`, `/install`, `/docs`, `/discover`, legal pages, `/pet/:id`

**Not indexed (`noindex`):** `/admin`, `/dashboard`, `/tracking`, `/nearby`, `/profile`, `/bookings`, checkout, etc.

## Optional next steps

- Add a 1200×630 **og-share.png** at `public/images/` for richer social previews
- Enable `REACT_APP_FIREBASE_MEASUREMENT_ID` for traffic analytics (separate from Search Console)
- Register **Google Business Profile** if you have a local Cyprus presence
- Build prerender/SSR for `/pet/:id` if share previews matter
