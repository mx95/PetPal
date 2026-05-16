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

- TCP: `5001` (override with `TCP_PORT`) — **trackers must connect here**
- HTTP: `5002` (override with `HTTP_PORT`)

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
