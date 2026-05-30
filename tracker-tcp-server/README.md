# Tracker TCP Server (Xexun)

This service accepts raw TCP connections from Xexun-style GPS trackers, parses `FC … CF` frames, sends **CRC-16/CCITT-FALSE** ACKs, can **queue server commands (0x21)** per the Xexun API PDF (e.g. `ip=host:port` for server switch), and exposes a small HTTP API.

## Run

```powershell
cd tracker-tcp-server
npm install
npm start
```

## PM2 — keep GPS history across restarts

Data is stored in **SQLite** (default: `tracker-tcp-server/data/petpal.sqlite`). A normal `pm2 restart` must **not** wipe history.

If history disappears after every restart, the process was almost certainly using a **different database file** each time (relative `./data/...` resolved from the wrong working directory) or `PERSIST_TO_SQLITE=0` (RAM only).

**Fix (recommended):**

```bash
cd ~/PetPal/tracker-tcp-server
pm2 delete tracker   # only if you need to re-register the app
pm2 start ecosystem.config.cjs
pm2 save
pm2 logs tracker --lines 30
```

You should see:

```text
[db] SQLite enabled at /.../tracker-tcp-server/data/petpal.sqlite
[db] 1234 position rows on disk (persists across pm2 restart)
```

If the row count is `0` but you had data before, search for older DB files and copy the largest into `data/petpal.sqlite`:

```bash
find ~/PetPal -name "petpal.sqlite" -exec ls -lh {} \;
# then, after stopping pm2:
cp /path/to/largest/petpal.sqlite ~/PetPal/tracker-tcp-server/data/petpal.sqlite
pm2 restart tracker
```

**Never set** `PERSIST_TO_SQLITE=0` in production.

## Backup GPS data (before restart or deploy)

All collar history lives in one file: `data/petpal.sqlite`.

**One-off backup (recommended — works while PM2 is running):**

```bash
cd ~/PetPal/tracker-tcp-server
chmod +x scripts/backup-sqlite.sh
./scripts/backup-sqlite.sh
```

Backups go to `data/backups/petpal-YYYYMMDD-HHMMSS.sqlite` (keeps the 14 newest).

**Manual backup:**

```bash
mkdir -p ~/PetPal/tracker-tcp-server/data/backups
sqlite3 ~/PetPal/tracker-tcp-server/data/petpal.sqlite \
  ".backup '~/PetPal/tracker-tcp-server/data/backups/petpal-manual-$(date -u +%Y%m%d).sqlite'"
ls -lh ~/PetPal/tracker-tcp-server/data/backups/
```

**Copy off the server (optional):** download the backup with `scp` to your PC so a full server loss does not lose history.

**Restore from backup:**

```bash
pm2 stop tracker
cp ~/PetPal/tracker-tcp-server/data/backups/petpal-YYYYMMDD-HHMMSS.sqlite \
   ~/PetPal/tracker-tcp-server/data/petpal.sqlite
pm2 start tracker
```

**Daily automatic backup (cron, 03:15 UTC):**

```bash
crontab -e
# add:
15 3 * * * cd /root/PetPal/tracker-tcp-server && ./scripts/backup-sqlite.sh >> /var/log/petpal-db-backup.log 2>&1
```

`pm2 restart tracker` does **not** delete `data/petpal.sqlite` — backups are for mistakes, disk failure, or before risky changes.

## Ports

- **Xexun** TCP: `5001` (`TCP_PORT`) — `FC … CF` binary frames
- **365GPS / Zhongxun** TCP: `5003` (`GPS365_TCP_PORT`) — `7878 … 0D0A` frames (separate listener; do not mix with Xexun on the same port)
- HTTP: `5002` (`HTTP_PORT`)

Set `GPS365_TCP_ENABLED=0` to disable the 365GPS listener only.

## 365GPS / Zhongxun trackers

These devices use a **different wire format** from Xexun (`7878` header, `0D0A` footer). They must connect to **`GPS365_TCP_PORT` (default 5003)**.

**Full protocol matrix, ACK rules, and HTTP command list:** [`docs/G365_PROTOCOL.md`](docs/G365_PROTOCOL.md)

### What is implemented today

**Location (spec minimum §9):** login, heartbeat, GPS online/offline, status, WiFi/LBS (2G + 4G), time sync — with correct mandatory ACKs.

**Common server commands (HTTP):** server redirect (`0x66`), manual position (`0x80`), upload interval (`0x97`), status/heartbeat intervals (`0x13`), prohibit LBS (`0x33`), restart/shutdown (`0x48`), find device (`0x49`), overspeed limit (`0x86`), phone numbers (`0x40`–`0x43`), expiry date (`0x30`), and **raw hex** for any other PDF command.

**Not implemented:** FTP/voice (`0x51`/`0x65`/`0xAA`), full settings sync reply (`0x57`/`0x58`), server-side LBS geocoding, healthcare-bracelet-only features.

### Quick start

```http
POST /api/g365/commands/server-redirect
{ "imei": "123456789012345", "host": "116.203.209.68", "port": 5003 }

POST /api/g365/commands/manual-position
{ "imei": "123456789012345", "mode": "gps" }
```

Open firewall: `ufw allow 5003/tcp` (in addition to `5001/tcp` if you use Xexun).

Parsed positions feed the **same SQLite store** and `/api/app/position` as Xexun collars.

## HTTP API (production structure)

This service exposes **two API groups**:

- **App API** (frontend-safe): `GET /api/app/*`
  - Used by **PetPal web UI** only
  - Reads from **SQLite** so devices persist across restarts
- **Tracker API** (protocol/commands): `POST /api/tracker/commands/*`
  - Used for **device configuration** only (queues Xexun 0x21 commands)
  - Commands are sent **one per uplink** after ACK on `0x20`

### App API (frontend-safe)

- **List devices**: `GET /api/app/devices`
- **Get one device**: `GET /api/app/devices/:imei`
- **Latest position**: `GET /api/app/position?deviceId=IMEI`
- **History**: `GET /api/app/history?deviceId=IMEI&limit=…` (optional `from` / `to` as ISO timestamps for a chronological window, up to 20k points; without them, the latest points are returned). Response includes `calendarMatch` (`false` when the server returned a recent trail because nothing fell in the requested window — e.g. device GPS clock wrong vs real dates).
- **Save home map pin** (for Wi‑Fi-at-home display): `POST /api/app/home` body `{ "deviceId": "IMEI", "lat": number, "lng": number }`

### Position response notes

- **GPS** packets return trusted `lat`/`lng`.
- **LBS (cell)** returns approximate `lat`/`lng`.
- **Wi‑Fi** packets from the collar contain **BSSID list only** — not coordinates. When the device is at home Wi‑Fi:
  - Without saved home: `lat`/`lng` are `null`, `atHomeWifi: true`, `wifiBssids: [...]`.
  - With saved home (`POST /api/app/home` or GPS-learned `home_lat`/`home_lng` in SQLite): `locationKind: "home_wifi"`, `lat`/`lng` = saved home, `gpsValid: false`.
- Wi‑Fi/LBS coords from the same packet are **not** mixed (avoids wrong cell-tower pins).

See **`docs/TRACKING_SETUP.md`** for HTTP vs HTTPS, frontend env vars, and deploy checklist.

### Tracker API (device commands)

All command endpoints live under:

- `POST /api/tracker/commands/*`
- `GET /api/tracker/commands/pending/:imei`

Examples:

- **Server switch**: `POST /api/tracker/commands/ip-transfer` body `{ imei, host, port? }`
- **Queue raw command**: `POST /api/tracker/commands/queue` body `{ imei, command }`
  - e.g. `ip=116.203.209.68:5001`, `tk=...`, `APN=internet`

**CORS** allows `GET`, `POST`, `OPTIONS` for browser clients.

### If you see `Cannot POST /api/tracker/commands/…`

The Node process is an **older build** without these routes. On the server:

```bash
cd ~/PetPal && git pull && cd tracker-tcp-server && npm install && pm2 restart all
```

(use your actual PM2 process name instead of `all` if needed).

## Server switch (`ip=`) — Xexun API

The vendor protocol defines **IP transfer** as plain command text, e.g.:

- `ip=p.xexun.com:8899` (factory / platform default in the PDF)
- `ip=116.203.209.68:5001` — point the collar at **your** TCP listener

Use `POST /api/tracker/commands/ip-transfer` with your Hetzner public IPv4 and the same `TCP_PORT` you expose on the firewall.

### Important

1. **First hop:** If the device currently reports only to Xexun’s cloud, it may **never open TCP to your VPS** until it receives `ip=…` once. That first instruction is often sent from **Xexun’s web platform** (“server switching / API”) after their checks pass — or via **SMS / manufacturer tool**, depending on the model.
2. After the device **does** connect to your server at least once, you can queue further `ip=` / `tk=` / etc. commands via this service.
3. Open **TCP** on the host/port you put in `ip=` (e.g. UFW `allow 5001/tcp`).

## Notes

- Payload parsing for GPS / status blocks is **best-effort** for various firmware layouts.
- Application commands must end with `0x00` in the binary frame; `buildServerCommand021` handles that.
