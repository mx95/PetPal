# Public route inventory — BEFORE SEO/GEO implementation

Generated from `petpal/src/App.js`, `petpal/src/config/appRouteCatalog.js`, and navigation components.
**Do not change page names, paths, or navigation labels.**

| Path | Page / component | Nav label (en) | Auth | Index intent (pre-change) |
|------|------------------|----------------|------|---------------------------|
| `/` | HomeScreen | Home | public | index |
| `/discover` | DiscoverHome | (hidden MVP) | public | index |
| `/login` | Login | Log in | public | noindex |
| `/register` | Register | Get started / Register | public | noindex |
| `/forgot-password` | ForgotPassword | — | public | noindex |
| `/contact` | Contact | Contact (footer) | public | index |
| `/install` | InstallApp | Install (footer) | public | index |
| `/docs` | Documentation | Docs | public | index |
| `/privacy` | PrivacyPolicy | Privacy | public | index |
| `/terms` | TermsOfService | Terms | public | index |
| `/cookies` | CookiePolicy | Cookies | public | index |
| `/shop` | Shop | Shop | public | index |
| `/shop/nfc` | ShopNfc | (via Shop / home capability) | public | noindex (via `/shop/*` rule) |
| `/shop/checkout` | ShopCheckout | — | auth | noindex + robots Disallow |
| `/nearby` | Nearby | Nearby | public | robots Disallow; app SEO index:true (conflict) |
| `/pet/:id` | PublicPetProfile | — | public | index |
| `/pet` | PublicPetProfile | — | public | index |
| `/lost-pet` | LostPetAlerts | Lost Pets (menu) | public | noindex prefix |
| `/lost-pet/:alertId` | LostPetDetail | — | public | noindex prefix |
| `/shelters` | SheltersHub | Shelters (menu) | public* | noindex prefix |
| `/stray-adoption` | redirect → shelters | — | public | redirect |
| `/dashboard` | Dashboard | Activity / home signed-in | auth | noindex |
| `/tracking` | Tracking | Tracking | auth | noindex |
| `/pets` | MyPets | My pets | auth | noindex |
| `/bookings/*` | BookingsHub | Bookings | auth | noindex |
| `/profile` | Profile | Profile | auth | noindex |
| `/inbox` | Inbox | Inbox | auth | noindex |
| `/activity` | ActivityHub | Activity | auth | noindex |
| `/provider` | ProviderPortal | Provider | auth | noindex |
| `/premium/*` | PremiumHub | Premium | auth | noindex |
| `/community` | Community | Community | auth | noindex |
| `/leaderboard` | Leaderboard | — | auth | noindex |
| `/payment/*` | PaymentSuccess/Failed | — | auth | noindex |
| `/admin/*` | Admin* | Admin | admin | noindex |

\* Shelters routes are public for browsing; catalog marks some as auth for MVP docs.

## Navigation labels preserved (en)

- Top/bottom: Home, Nearby, Shop, Tracking, Bookings, Lost Pets, Shelters, My pets, Inbox, Profile, Provider, Menu, Log in, Get started
- Footer: Instagram, Facebook, TikTok, Privacy, Terms, Contact, Install

## Notes for audit

1. SPA (Create React App) — meaningful product copy largely client-rendered; `index.html` noscript is the main crawler fallback.
2. `robots.txt` Disallows `/nearby` while `seo.js` marks Nearby indexable — crawl/index conflict.
3. `/shop/nfc` exists but is treated as noindex under `/shop/` rule and missing from sitemap.
4. Sitemap lists 9 URLs; lastmod on home is stale (2026-08-23).
5. No `OAI-SearchBot` directives yet; GPTBot not configured (leave unchanged).
