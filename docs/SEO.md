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
| `tracker-tcp-server/src/index.js` | Explicit `/robots.txt` and `/sitemap.xml` routes |

---

## ✅ Domain verified (Cloudflare DNS)

If Search Console shows **“Ownership auto verified”** via Cloudflare, you are done with verification for the whole domain (`petpal.com.cy` + subdomains).

### Do these next (in order)

#### 1. Deploy the latest code

The SEO meta tags and sitemap only work **after deploy**. Until then, Google still sees the old `PetPal GPS Tracker` page and `/sitemap.xml` returns HTML.

After deploy, confirm:

- `https://petpal.com.cy/sitemap.xml` → XML list of URLs (not the React app)
- View source on `/` → title should be **“PetPal Care Hub | GPS Pet Tracker & NFC Tags — Cyprus”**

#### Sitemap error: “Sitemap is HTML”

Google read `/sitemap.xml` **before** the SEO deploy (every URL returned the React app). The file is valid XML now.

**Fix:**

1. Open `https://petpal.com.cy/sitemap.xml` on your phone — must start with `<?xml version="1.0"`, not the PetPal app.
2. Search Console → **Sitemaps** → delete the failed submission.
3. Submit again: enter only `sitemap.xml` (not `https://petpal.com.cy/sitemap.xml`).
4. Wait **24–48 hours** — status should become **Success** with ~9 pages discovered.

Optional: **Cloudflare** → Caching → **Purge Everything** once so edge cache does not serve old HTML.

#### 2. Submit your sitemap

In [Google Search Console](https://search.google.com/search-console):

1. Open your **petpal.com.cy** property
2. Left menu → **Sitemaps** (under “Indexing”)
3. Enter: `sitemap.xml` → **Submit**

#### 3. Request indexing for key pages

1. Left menu → **URL inspection** (top search bar)
2. Enter `https://petpal.com.cy/` → **Request indexing**
3. Repeat for `https://petpal.com.cy/shop`

#### 4. Wait for data

The Overview page shows **“Processing data, please check again in a day or so”** — that is normal for a new property. Indexing often takes **3–14 days** before brand searches like `PetPal Cyprus` return results.

---

## Production env (before `npm run build`)

```bash
REACT_APP_SITE_URL=https://petpal.com.cy
```

DNS verification is already done — you do **not** need `REACT_APP_GOOGLE_SITE_VERIFICATION` unless you add a second verification method.

## Pick one canonical domain

Use either `petpal.com.cy` or `www.petpal.com.cy` in marketing links. Redirect the other in nginx to avoid duplicate listings.

## Search terms

You will usually appear first for **brand searches** (`PetPal`, `PetPal Cyprus`, `petpal.com.cy`) before generic terms (`GPS pet tracker Cyprus`).

## Updating the sitemap

When you add new **public** pages, add a `<url>` to `petpal/public/sitemap.xml`, redeploy, then resubmit the sitemap in Search Console.

## Indexable vs private routes

**Indexed (public):** `/`, `/shop`, `/contact`, `/install`, `/docs`, `/discover`, legal pages, `/pet/:id`

**Not indexed (`noindex`):** `/admin`, `/dashboard`, `/tracking`, `/nearby`, `/profile`, `/bookings`, checkout, etc.

## Optional next steps

- Add a 1200×630 share image at `public/images/og-share.png`
- Enable `REACT_APP_FIREBASE_MEASUREMENT_ID` for traffic analytics
- **Register Google Business Profile** — step-by-step: [GOOGLE_BUSINESS_PROFILE.md](./GOOGLE_BUSINESS_PROFILE.md)
- Link Instagram / social profiles to `petpal.com.cy`
