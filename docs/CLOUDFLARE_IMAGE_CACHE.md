# Cloudflare image caching (petpal.com.cy)

Origin (`tracker-tcp-server`) sets cache headers so Cloudflare’s free CDN can store images at the edge.

## What the server sends

| Path / type | `Cache-Control` | Edge (`CDN-Cache-Control`) |
|-------------|-----------------|----------------------------|
| `/static/*` (hashed JS/CSS) | `public, max-age=31536000, immutable` | 1 year |
| Images / icons (`/images/*`, `/ui-icons/*`, `/nearby-*`, `.png`/`.jpg`/…) | `public, max-age=2592000, stale-while-revalidate=86400` | 30 days |
| `index.html`, service worker | `no-store` | not cached |
| `manifest` / fonts / txt / xml | `public, max-age=86400` | 1 day |

After deploy, confirm with:

```bash
curl -sI https://petpal.com.cy/images/home-hero.jpg | grep -iE 'cache-control|cf-cache|cdn-cache'
# Expect: cf-cache-status: HIT (or MISS then HIT on second request)
```

## Optional Cloudflare dashboard rules

If you want an extra guarantee in the Cloudflare UI (Caching → Cache Rules):

1. **If** hostname equals `petpal.com.cy` **and** URI Path matches  
   `.*\.(avif|gif|ico|jpe?g|png|svg|webp)$` **or** path starts with `/images/`, `/ui-icons/`, `/nearby-icons/`, `/nearby-pins/`
2. **Then** Eligible for cache = Yes, Edge TTL = 1 month (or “Respect origin”)

No API token is required in this repo; origin headers alone are enough for Cloudflare to cache these extensions by default.

## Replacing an image

When you change a file that keeps the same URL (e.g. `home-hero.jpg`), either:

- bump a query string in the app (`?v=…`), or  
- purge that URL in Cloudflare → Caching → Configuration → Purge Cache
