# PetPal tracker types — Xexun, 365GPS, GT06, GPSPOS

How each collar backend connects to **tracker-tcp-server** and what the PetPal app shows.

| Provider | How data arrives | Default TCP port | PetPal Device tab |
|----------|------------------|------------------|-------------------|
| **xexun** | Collar → your server (binary FC…CF) | 5001 | Battery plans, GPS-only mode, Wi‑Fi home |
| **g365** | Collar → your server (7878…0D0A, 365GPS) | 5003 | Upload/status presets, locate, ring, restart |
| **gt06** | Collar → your server (7878…0D0A, GT06 / GPSPOS direct) | 5004 | Live map + battery/signal from TCP status |
| **gpspos** | Server polls gpspos.net API | — (cloud) | Refresh from cloud + poll status |

All four use the same **read** endpoints for maps:

- `GET /api/app/position?deviceId={imei}`
- `GET /api/app/history?deviceId={imei}&from=&to=&limit=`
- `GET /api/app/devices/:imei`

---

## Assigning provider per IMEI

**Admin UI:** `/admin/devices` (Firestore `admins/{uid}` + tracker token).

**API:** `PATCH /api/admin/devices/:imei` with header `X-PetPal-Admin-Token: {TRACKER_ADMIN_TOKEN}`.

| Field | Purpose |
|-------|---------|
| `providerOverride` | `null` (auto), `xexun`, `g365`, `gt06`, or `gpspos` |
| `gpsposPlatformImei` | Platform login id when it differs from the 15-digit IMEI |
| `gpsposPollEnabled` | `true` to auto-pull from gpspos.net |
| `gpsposPollIntervalSec` | 15–86400 (presets: 30s, 1m, 2m, 5m, 10m, 30m, 1h) |

When override is **auto**, the server infers provider from the last ingest (TCP frame shape or cloud sync metadata).

Stored in SQLite `devices` columns: `provider_override`, `gpspos_platform_imei`, `gpspos_poll_interval_sec`, `gpspos_poll_enabled`.

---

## Xexun

### Wire protocol

- Binary frames: start `FC`, end `CF`
- Collar opens TCP to your public IP on port **5001**
- Uplink: GPS, LBS, Wi‑Fi scan, battery, steps
- Downlink: text commands wrapped in 0x21 frames, sent on next uplink

### Onboarding

1. Admin queues **ip-transfer** at `/admin/tracker` → `POST /api/tracker/commands/ip-transfer` `{ imei, host, port: 5001 }`
2. Collar receives command on next heartbeat and switches server
3. First FC frame creates/updates the device row

### Commands (Xexun-only)

Base: `/api/tracker/commands/*` or `/commands/*`

- Tracking intervals: `POST …/tracking` with `{ imei, tk }` or `{ imei, p1…p7 }`
- Wi‑Fi home BSSID list: `POST …/wifi`
- Restart, APN, timezone, messages — see [API_REFERENCE.md](./API_REFERENCE.md)

### Inference

- `provider = xexun` when raw hex starts with `FC`, or after explicit override

---

## 365GPS (G365)

### Wire protocol

- Frames: `7878 … 0D0A`
- TCP port **5003** (`GPS365_TCP_PORT`)
- Commands require an **active TCP session** (collar online)

### Device tab behaviour

- **Battery plans** map to upload interval (seconds) + status interval (minutes)
- Quick actions: manual GPS fix, find/ring, restart
- API: `/api/g365/commands/*` — see [G365_PROTOCOL.md](./G365_PROTOCOL.md)

### Inference

- `provider = g365` when `protocol` field is numeric (non-GT06 ids) or raw starts with `7878` without a GT06 stamp

---

## GT06 (GPSPOS direct TCP)

### Wire protocol

- Same outer framing as 365GPS (`7878 … 0D0A`) but **GT06** message set + **CRC-ITU**
- TCP port **5004** (`GT06_TCP_PORT`)
- Login `0x01`, location `0x12`, status `0x13`, alarm `0x16`
- Full notes: [GT06_PROTOCOL.md](./GT06_PROTOCOL.md)

### Onboarding (GPSPOS hardware)

1. Open firewall TCP **5004**
2. Redirect collar server IP/port from gpspos.net → your host:`5004`
3. Confirm login + GPS in tracker logs (`[GT06]`)
4. Admin provider **gt06** (auto after first packet, or set override)

Cloud poll (`gpspos`) remains available for units that stay on gpspos.net.

### Inference

- `provider = gt06` when stamped on TCP upsert, override set, or protocol is `0x12` / `0x13` / `0x16`

---

## GPSPOS (cloud)

### Architecture

- Physical collar reports to **gpspos.net**, not your TCP ports
- PetPal server logs into the platform JSONP API (`GPSPOS_API_URL`)
- Calls `Proc_GetLastPosition` / `Proc_GetTrack` and writes into local SQLite

### Polling

Per-device settings from `/admin/devices` (preferred) or legacy env:

| Env (fallback) | Purpose |
|----------------|---------|
| `GPSPOS_ENABLED` | Master switch |
| `GPSPOS_DEVICE_IDS` | IMEIs to poll if not configured in DB |
| `GPSPOS_IMEI_MAP` | `fullImei:platformId` |
| `GPSPOS_POLL_INTERVAL_SEC` | Default interval when per-device not set |

The poller runs **one timer per IMEI** with its own interval. Config is reloaded every 60s.

### Manual sync

- `POST /api/gpspos/sync` `{ imei }` — latest fix (also used by Device tab **Refresh from cloud**)
- `POST /api/gpspos/sync/history` `{ imei, fromUnix, toUnix }` — import track

Setup details: [GPSPOS_SETUP.md](./GPSPOS_SETUP.md)

Prefer **GT06 direct TCP** (port 5004) when the collar firmware allows a custom server IP — lower latency and no platform account.

### Inference

- `provider = gpspos` when override set, after cloud sync metadata, or `gpspos` object on device record

---

## App routes reference

See in-app **/docs** or `petpal/src/config/appRouteCatalog.js` for every path including MVP-hidden pages (`/dashboard`, `/community`, `/premium/*`, `/admin/devices`, etc.).

## Environment checklist (production)

**Tracker server (PM2):**

```bash
TRACKER_ADMIN_TOKEN=your-secret-token
GT06_TCP_ENABLED=1
GT06_TCP_PORT=5004
GPSPOS_ENABLED=1
GPSPOS_API_URL=https://www.gpspos.net/AppJson.asp
GPSPOS_USER=...
GPSPOS_PASSWORD=...
```

**React build (`petpal/.env.local` before `npm run build`):**

```bash
REACT_APP_XEXUN_HTTP_BASE_URL=same
REACT_APP_TRACKER_ADMIN_TOKEN=your-secret-token   # same value as server
```

Restart PM2 after server env changes; rebuild and redeploy the React app after frontend env changes.
