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
| `REACT_APP_TRACKING_MAP` | *(omit)* | Tracker page uses **Google Maps** when `REACT_APP_GOOGLE_MAPS_API_KEY` is set. Set `osm` only if you prefer OpenStreetMap/Leaflet on the tracking page. |
| `REACT_APP_TRACKING_WIFI_ENABLED` | *(see below)* | Wi‑Fi home tracking + Device tab + one-tap home. |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | optional | Tracker map (when set), **Nearby** / Places, and company place search. |

See `petpal/.env.example` for Firebase and other optional vars.

---

## HTTP vs HTTPS — Device tab on `http://` when tracker API is configured

**Your current setup (`http://116.203.209.68:5002`) uses HTTP.**

When **`REACT_APP_XEXUN_HTTP_BASE_URL`** is set at build time (typically `same` on the PM2 host), the **Device** tab is **shown** on HTTP — router BSSID setup and tracking-mode commands use the same-origin tracker API and do not require HTTPS.

Still **HTTPS-only** (browser secure context):

- **One-tap “Set home on map”** (phone geolocation)
- Optional: force everything off with `REACT_APP_TRACKING_WIFI_ENABLED=0`

Tracking still works with **GPS** and **cell (LBS)** on the **Live** and **History** tabs regardless.

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
| **Wi‑Fi packet** | Router IDs (`wifiBssids`) only — **no coordinates** | Home pin only if you saved home lat/lng |

The server marks `atHomeWifi: true` when the collar scans nearby routers. That is **status**, not a street address.

Old mislabeled history (Wi‑Fi rows with cell-tower coordinates) is **not** used for the live map pin.

---

## What is `wifiBssids`?

**BSSID** = the unique hardware ID (MAC address) of a Wi‑Fi router or access point, e.g. `14:75:90:5b:d3:0e`.

**`wifiBssids`** = the list of those IDs the **collar heard** during its last Wi‑Fi scan. Example from the API:

```json
"wifiBssids": ["14:75:90:5b:d3:0e", "ba:af:ca:8c:22:b1", "a4:2b:8c:01:23:45"]
```

| Fact | Detail |
| --- | --- |
| **What it is** | Fingerprints of nearby routers — not lat/lng |
| **Who creates it** | The collar scans the air; the server stores what it uploads |
| **What it is not** | Your home address, router password, or Wi‑Fi network name (SSID) |
| **Why it matters** | Lets the app know the pet is **in a Wi‑Fi-rich area** (often at home) |
| **Map pin** | Appears only if you also saved **home coordinates** (`POST /api/app/home` or one-tap home) |

Think of it like: the collar says *“I can see these routers”* and the app says *“when I see Wi‑Fi like that, draw the pin at the home location I saved.”*

The sticker on your router may show `80:AF:CA:…` while the collar reports `ba:af:ca:…` — same device, different radio interface. **Trust what appears in server logs / `GET /position`**, not the label.

365GPS packets include up to **8** BSSIDs (minimum **3** visible networks before a full Wi‑Fi fix per vendor spec). Each entry is 6 bytes BSSID + signal strength (RSSI).

---

## Wi‑Fi home setup

Wi‑Fi tracking needs **two separate things**:

1. **Collar detects Wi‑Fi** → sends `wifiBssids` (and `atHomeWifi: true`).
2. **You save home on the map** → server knows where to draw the pin.

Without (1): you may only get LBS/GPS. Without (2): API returns `wifiBssids` but `lat`/`lng` stay null.

One-tap **Set home on map** requires **HTTPS** or `localhost` (browser geolocation). Saving home via **`POST /api/app/home`** works on HTTP too.

### Xexun collar (TCP port **5001**)

Uses the app **Device** tab:

1. **Router code (BSSID)** — programs the collar via `wifi=` command (`POST /api/tracker/commands/wifi`).
2. **Home on the map** — one-tap home or `POST /api/app/home`.

Tracking mode presets (`tk=` — Wi‑Fi priority / GPS priority / GPS only) are **Xexun only**.

### 365GPS collar (TCP port **5003**)

**Do not** use Device tab BSSID / `wifi=` / `tk=` — those commands are ignored by 365GPS.

The 365GPS collar **auto-scans** nearby Wi‑Fi and sends packets **`0x69`** or **`0x18`** when it finds enough routers (typically **3+** on **2.4 GHz**). No manual MAC programming in PetPal.

**Step 1 — Save home coordinates**

App: Tracking → **Set home on map** (HTTPS), or API:

```bash
curl -X POST http://YOUR_IP:5002/api/app/home \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"861261021497967","lat":34.985,"lng":33.845}'
```

**Step 2 — Trigger a Wi‑Fi scan** (collar must be online on port 5003)

```bash
curl -X POST http://YOUR_IP:5002/api/g365/commands/manual-position \
  -H "Content-Type: application/json" \
  -d '{"imei":"861261021497967","mode":"wifi"}'
```

**Step 3 — Verify in logs**

```bash
pm2 logs tracker --lines 40 | grep 365GPS
```

Look for `"source":"wifi"` and `"wifiBssids":[…]` in `PARSED` JSON. Protocol `105` (`0x69`) = online Wi‑Fi+LBS packet.

If you only see `0x1b` with `"wifiBssids":null`, the collar sees cell towers but **not enough Wi‑Fi APs** — move closer to the router, enable **2.4 GHz**, or wait for neighbor networks to be visible.

**Success response** (`GET /position?deviceId=…`):

```json
{
  "atHomeWifi": true,
  "source": "wifi",
  "locationKind": "home_wifi",
  "lat": 34.985,
  "lng": 33.845,
  "wifiBssids": ["14:75:90:5b:d3:0e"]
}
```

---

## Server deploy (single PM2 app)

One process (`tracker`) on port **5002** serves:

- Static PetPal SPA (`petpal/build/`)
- HTTP API (`/api/app/*`, `/position`, …)
- TCP ingest: **5001** (Xexun), **5003** (365GPS) — collars connect on separate ports

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
| 365GPS: always `source: lbs`, no `wifiBssids` | Not enough visible Wi‑Fi APs | Enable 2.4 GHz; `POST /api/g365/commands/manual-position` with `"mode":"wifi"`; need ~3 networks in range. |
| 365GPS: `wifiBssids` but no map pin | Home not saved | `POST /api/app/home` or one-tap home (HTTPS). |
| Used Device tab BSSID on 365GPS | Xexun-only command | Use auto-scan + home save flow above; port **5003**. |
| No Device tab | `REACT_APP_XEXUN_HTTP_BASE_URL` not set at build | Set `REACT_APP_XEXUN_HTTP_BASE_URL=same` (or full URL), then `npm run build`. |
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
- `tracker-tcp-server/docs/API_REFERENCE.md` — **all HTTP endpoints & capabilities matrix**
- `tracker-tcp-server/docs/G365_PROTOCOL.md` — 365GPS Wi‑Fi/LBS packet formats (`0x69`, `0x18`, `0x1b`)
- `tracker-tcp-server/docs/GPSPOS_SETUP.md` — gpspos.net cloud collars
- `docs/DOMAIN_SETUP.md` — **petpal.com.cy** DNS, nginx, Let's Encrypt
- `petpal/README.md` — Firebase, Capacitor, deploy commands
- `petpal/.env.example` — all env vars with short comments
