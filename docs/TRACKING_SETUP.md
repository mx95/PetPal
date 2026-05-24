# PetPal GPS tracking — setup & operations

This guide covers the **PetPal web app** + **tracker-tcp-server** (TCP port 5001, HTTP port 5002) as deployed on Hetzner (e.g. `http://116.203.209.68:5002`).

---

## Quick checklist (after every deploy)

```bash
cd ~/PetPal && git pull

cd petpal
npm ci          # only if package.json / lockfile changed
npm run build   # required for UI changes — env vars are baked in at build time

cd ../tracker-tcp-server
npm ci          # only if package.json changed
pm2 restart tracker
pm2 logs tracker --lines 30
```

In the browser: **hard refresh** (`Ctrl+F5` / clear cache) so the new JS bundle loads.

Verify logs show SQLite with row count, not `PERSIST_TO_SQLITE=0`.

Optional API smoke test (from your PC):

```bash
curl -s "http://YOUR_IP:5002/position?deviceId=YOUR_IMEI" | jq .
cd tracker-tcp-server && TRACKER_BASE=http://YOUR_IP:5002 node scripts/verify-tracking-alignment.js
```

---

## Environment variables (frontend build)

Create **`petpal/.env.local`** for local dev, or set the same variables **on the server before `npm run build`** (Create React App embeds them at build time — changing env after build does nothing until you rebuild).

| Variable | Typical value | Notes |
| --- | --- | --- |
| `REACT_APP_XEXUN_HTTP_BASE_URL` | `same` | App is served from tracker host on `:5002`. Use full URL if UI and API are on different origins. **Required** for live tracking against your server. |
| `REACT_APP_TRACKING_MAP` | `osm` | Tracker page map: OpenStreetMap/Leaflet (default). Set `google` only if you want Google on the tracking page. |
| `REACT_APP_TRACKING_WIFI_ENABLED` | *(see below)* | Wi‑Fi home tracking + Device tab + one-tap home. |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | optional | Used for **Nearby** / Places, not the tracker map when `REACT_APP_TRACKING_MAP=osm`. |

See `petpal/.env.example` for Firebase and other optional vars.

---

## HTTP vs HTTPS — Wi‑Fi tracking is **off** on `http://`

**Your current setup (`http://116.203.209.68:5002`) does not use HTTPS.**

Wi‑Fi-related UI is **disabled automatically** when the page is not a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts):

- No **Device** tab (router BSSID setup, tracking mode commands)
- No **Wi‑Fi** badge / “at home on Wi‑Fi” empty states
- No **one-tap “Set home on map”** (uses browser geolocation, which requires HTTPS except on `localhost`)

Tracking still works with **GPS** and **cell (LBS)** on the **Live** and **History** tabs.

### When you add HTTPS later

1. Serve the app over `https://…`
2. Set at build time:
   ```bash
   REACT_APP_TRACKING_WIFI_ENABLED=1
   ```
3. Rebuild: `cd petpal && npm run build`
4. Restart PM2: `pm2 restart tracker`

The **Device** tab and Wi‑Fi home flow return.

### Force Wi‑Fi off even on HTTPS

```bash
REACT_APP_TRACKING_WIFI_ENABLED=0
```

### Force Wi‑Fi on (only if you have HTTPS)

```bash
REACT_APP_TRACKING_WIFI_ENABLED=1
```

If unset: **on** for `https://` and `localhost`, **off** for plain `http://`.

Implementation: `petpal/src/tracking/trackingWifiFeature.js`.

---

## What the collar sends (important)

| Source | What you get | Map pin |
| --- | --- | --- |
| **GPS** | Accurate lat/lng outdoors | Yes — trusted pin |
| **LBS (cell)** | Approximate lat/lng | Yes — large accuracy circle |
| **Wi‑Fi packet** | Router IDs (BSSIDs) only — **no coordinates** | No live GPS from Wi‑Fi alone |

The server marks `atHomeWifi: true` when the collar scans home routers. That is **status**, not a map location.

Old mislabeled history (Wi‑Fi rows with cell-tower coordinates) is **not** used for the live map pin.

---

## Wi‑Fi home setup (HTTPS only)

When Wi‑Fi tracking is enabled:

### 1. Router code (BSSID) — tells the **collar** you are home

- Not a street address.
- Use the code the **collar scans**, often `ba:af:ca:8c:22:b1`, not always the sticker `80:AF:CA:…`.
- Device tab → enter code → **Set up home tracking**.

### 2. Home on the map — tells the **app** where to draw the pin

- **One tap:** Live or Device tab → **Set home on map** while at home (allow browser location).
- **Or:** first outdoor **GPS fix** from the collar saves home automatically.
- No manual address entry.

API: `POST /api/app/home` with `{ "deviceId": "IMEI", "lat": …, "lng": … }`  
When home is saved and collar is on Wi‑Fi, `GET /position` returns `locationKind: "home_wifi"` with `lat`/`lng` = saved home.

---

## Server deploy (single PM2 app)

One process (`tracker`) on port **5002** serves:

- Static PetPal SPA (`petpal/build/`)
- HTTP API (`/api/app/*`, `/position`, …)
- TCP ingest on **5001** (separate port — collars connect here)

First-time PM2:

```bash
cd ~/PetPal/tracker-tcp-server
pm2 start ecosystem.config.cjs
pm2 save
```

**Never** set `PERSIST_TO_SQLITE=0` in production — you lose all history on restart.

Database file: `tracker-tcp-server/data/petpal.sqlite`  
Backups: `tracker-tcp-server/scripts/backup-sqlite.sh` — see `tracker-tcp-server/README.md`.

---

## API reference (app)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/app/position?deviceId=IMEI` | Latest status + coords (same as `/position`) |
| `GET /api/app/devices` | All devices (live memory merged with SQLite) |
| `GET /api/app/history?deviceId=IMEI&limit=…` | Route history |
| `POST /api/app/home` | Save home lat/lng for Wi‑Fi-at-home map display |

Wi‑Fi-at-home response shape (when home saved):

```json
{
  "atHomeWifi": true,
  "source": "wifi",
  "locationKind": "home_wifi",
  "lat": 34.123,
  "lng": 33.456,
  "homeLat": 34.123,
  "homeLng": 33.456,
  "gpsValid": false,
  "wifiBssids": ["ba:af:ca:8c:22:b1"]
}
```

Without saved home, Wi‑Fi responses have `lat`/`lng` null but still include battery, `wifiBssids`, and `atHomeWifi`.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Empty map, “no location” | Collar on Wi‑Fi only, no GPS/home saved | Normal on HTTP (Wi‑Fi UI off). Wait for LBS/GPS or enable HTTPS + one-tap home. |
| Wrong map pin (far away) | Old cell-tower coords | Fixed in current code; hard refresh + redeploy. Do **not** use sticker MAC if collar scans a different BSSID. |
| No Device tab | HTTP without HTTPS | Expected. Add HTTPS + `REACT_APP_TRACKING_WIFI_ENABLED=1` to enable. |
| “Tracker response had no usable lat/lng” | Old frontend | Rebuild `petpal` and hard refresh. |
| Stale device list vs live | Old server | `git pull`, `pm2 restart tracker`. |
| History gone after restart | Wrong DB path or `PERSIST_TO_SQLITE=0` | See `tracker-tcp-server/README.md` PM2 section. |
| Build fails: missing module | File not in git | `git pull`; ensure `trackingModePresets.js`, `trackingMapProvider.js` exist. |
| Tailwind/CSS broken on server | Tailwind v4 CLI | Use `npm run build` in `petpal` (pinned to Tailwind v3 CLI in `package.json`). |

---

## Local development

```bash
cd petpal
cp .env.example .env.local
# Fill Firebase + REACT_APP_XEXUN_HTTP_BASE_URL=http://116.203.209.68:5002  (or same)
yarn start
```

`localhost` is a secure context — Wi‑Fi features work in dev even without HTTPS if `REACT_APP_TRACKING_WIFI_ENABLED` is not forced to `0`.

---

## Related docs

- `tracker-tcp-server/README.md` — TCP protocol, PM2, SQLite backup, command API
- `petpal/README.md` — Firebase, Capacitor, deploy commands
- `petpal/.env.example` — all env vars with short comments
