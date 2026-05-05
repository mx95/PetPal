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

## HTTP API

**Discovery:** `GET /` returns JSON listing every route.

**Device data**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/devices` | All devices last seen |
| GET | `/devices/:imei` | One device snapshot |
| GET | `/position?deviceId=IMEI` | Latest lat/lng (PetPal / maps; 404 if no GPS fix) |

**Xexun 0x21 commands** (mapped from the vendor PDF). All are **queued** and sent **one per uplink** after ACK on `0x20`.

| Method | Path | Body (JSON) | Command text sent |
|--------|------|---------------|-------------------|
| POST | `/commands/queue` | `{ imei, command }` | Any raw string (`ip=…`, combined `#` commands, etc.) |
| POST | `/commands/ip-transfer` | `{ imei, host, port? }` | `ip=host:port` |
| POST | `/commands/ip/query` | `{ imei }` | `ip=?` |
| POST | `/commands/apn` | `{ imei, apn }` | `APN=name` |
| POST | `/commands/tracking` | `{ imei, tk }` **or** `{ imei, p1..p7 }` | `tk=…` |
| POST | `/commands/tracking/query` | `{ imei }` | `tk=?` |
| POST | `/commands/power-off` | `{ imei }` | `of=1` |
| POST | `/commands/restart` | `{ imei }` | `rt=1` |
| POST | `/commands/message` | `{ imei, text }` | `mg=…` |
| POST | `/commands/timezone` | `{ imei, tz }` | `tz=N` |
| POST | `/commands/timezone/query` | `{ imei }` | `tz=?` |
| POST | `/commands/ble` | `{ imei, bssid_list }` **or** `{ imei, clear: true }` **or** `{ imei, query: true }` | `ble=…` / `ble={}` / `ble=?` |
| POST | `/commands/wifi` | Same shape as `ble` | `wifi=…` / `wifi={}` / `wifi=?` |
| GET | `/commands/pending/:imei` | — | Lists queued strings |

**CORS** allows `GET`, `POST`, `OPTIONS` for browser clients.

### If you see `Cannot POST /commands/…`

The Node process is an **older build** without these routes. On the server:

```bash
cd ~/PetPal && git pull && cd tracker-tcp-server && npm install && pm2 restart all
```

(use your actual PM2 process name instead of `all` if needed).

## Server switch (`ip=`) — Xexun API

The vendor protocol defines **IP transfer** as plain command text, e.g.:

- `ip=p.xexun.com:8899` (factory / platform default in the PDF)
- `ip=116.203.209.68:5001` — point the collar at **your** TCP listener

Use `POST /commands/ip-transfer` with your Hetzner public IPv4 and the same `TCP_PORT` you expose on the firewall.

### Important

1. **First hop:** If the device currently reports only to Xexun’s cloud, it may **never open TCP to your VPS** until it receives `ip=…` once. That first instruction is often sent from **Xexun’s web platform** (“server switching / API”) after their checks pass — or via **SMS / manufacturer tool**, depending on the model.
2. After the device **does** connect to your server at least once, you can queue further `ip=` / `tk=` / etc. commands via this service.
3. Open **TCP** on the host/port you put in `ip=` (e.g. UFW `allow 5001/tcp`).

## Notes

- Payload parsing for GPS / status blocks is **best-effort** for various firmware layouts.
- Application commands must end with `0x00` in the binary frame; `buildServerCommand021` handles that.
