# Public route inventory — AFTER SEO/GEO implementation

Compared against `docs/SEO_ROUTE_INVENTORY_BEFORE.md`.

| Path | Page / component | Nav label (en) | Changed? |
|------|------------------|----------------|----------|
| `/` | HomeScreen | Home | **No** — path/name/nav unchanged |
| `/discover` | DiscoverHome | (hidden) | No |
| `/login` | Login | Log in | No |
| `/register` | Register | Get started | No |
| `/forgot-password` | ForgotPassword | — | No |
| `/contact` | Contact | Contact | No |
| `/install` | InstallApp | Install | No |
| `/docs` | Documentation | Docs | No |
| `/privacy` | PrivacyPolicy | Privacy | No |
| `/terms` | TermsOfService | Terms | No |
| `/cookies` | CookiePolicy | Cookies | No |
| `/shop` | Shop | Shop | No |
| `/shop/nfc` | ShopNfc | (via Shop) | No |
| `/shop/checkout` | ShopCheckout | — | No |
| `/nearby` | Nearby | Nearby | No |
| `/pet/:id` | PublicPetProfile | — | No |
| `/pet` | PublicPetProfile | — | No |
| `/lost-pet` | LostPetAlerts | Lost Pets | No |
| `/lost-pet/:alertId` | LostPetDetail | — | No |
| `/shelters*` | Shelters* | Shelters | No |
| `/dashboard` | Dashboard | Activity | No |
| `/tracking` | Tracking | Tracking | No |
| `/pets` | MyPets | My pets | No |
| `/bookings/*` | BookingsHub | Bookings | No |
| `/profile` | Profile | Profile | No |
| `/admin/*` | Admin* | Admin | No |

## Verification checklist

1. No existing route renamed — **pass**
2. No existing URL changed — **pass**
3. No page replaced by differently named page — **pass**
4. No navigation label changed — **pass** (only body copy / meta / SEO helper text)
5. No existing page removed — **pass**
6. No duplicate SEO landing under a new slug — **pass** (only improved existing `/shop`, `/shop/nfc`, `/nearby`, `/lost-pet`)
7. Routing/navigation unchanged — **pass**
8. App features preserved — **pass** (additive copy/sections only)

## Indexing policy changes (not URL changes)

| Path | Before | After |
|------|--------|-------|
| `/nearby` | robots Disallow; SEO index:true (conflict) | robots Allow; index; in sitemap |
| `/shop/nfc` | noindex via `/shop/*` | index; Product JSON-LD; in sitemap |
| `/lost-pet` | noindex prefix | index hub; detail URLs remain noindex |
| `/shelters` | not in robots | robots Disallow (align private/UGC) |
