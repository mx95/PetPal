# Tracker TCP Server (Xexun)

This service accepts raw TCP connections from Xexun-style GPS trackers, parses `FC … CF` frames, sends **CRC-16/CCITT-FALSE** ACKs, can **queue server commands (0x21)** per the Xexun API PDF (e.g. `ip=host:port` for server switch), and exposes a small HTTP API.

## Run

```powershell
cd tracker-tcp-server
npm install
npm start
```

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
- **History (last 100)**: `GET /api/app/history?deviceId=IMEI`

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
