# 365GPS / Zhongxun protocol (PetPal tracker-tcp-server)

Reference: *365GPS 2G and 4G GPS tracker communication protocol* (2024-07-02).

Devices connect to **`GPS365_TCP_PORT` (default 5003)** — not the Xexun port (`5001`).

Wire format: `7878` + length or WiFi-count + protocol + payload + `0D0A`.

---

## Embedded figures in vendor PDF (2024-07-02)

The Word document includes **three images** not visible in plain-text extraction. We re-read these and aligned the parser/docs.

### Figure 1 — Extended status packet (`0x13`)

Annotated hex (length `0x16`, protocol `0x13`):

| Field | Size | Example |
|-------|------|---------|
| Battery | 1 | `0x60` |
| Software version | 1 | `0x03` |
| Time zone | 1 | `0x08` |
| Status upload interval (min) | 1 | `0x58` |
| Signal | 1 | `0x5A` |
| Recharging | 1 | `0x01` = plugged in |
| Temperature | 2 | `0x0000` |
| Heart rate | 1 | `0x00` |
| Pedometer (steps) | 4 | `0x00000000` |
| Activity time | 2 | `0x0001` |
| Date | 6 BCD | `17050A11021C` → 2017-05-10 11:02:28 |

**Implementation:** `parseStatusBody()` — variants `basic` (5 bytes), `withCharging` (6+), `extended` (21+). Steps/charging/timestamp flow into `deviceStatus`.

### Figure 2 — 4G WiFi+LBS table (`0x18`)

Confirms wire layout (matches our `tryWifiLbsFrameLength()` / `parseWifiLbsBody()`):

| Field | Size | Notes |
|-------|------|-------|
| Start | 2 | `7878` |
| WiFi count | 1 | max **8** |
| Protocol | 1 | `0x18` |
| Date/time | 6 BCD | |
| WiFi data | 7 × count | 6-byte BSSID + 1-byte RSSI |
| LBS count | 1 | max **6** (4G) |
| MCC/MNC | 3 | |
| LBS cells | 9 × count | LAC 4 + CellID 4 + RSSI 1 |
| Alarm | 1 | V1.2 |
| End | 2 | `0D0A` |

2G `0x17`/`0x69` uses **5-byte** cells (LAC 2 + CellID 2 + RSSI 1) per PDF text; 4G uses 9-byte cells per this figure.

### Figure 3 — Attendance app UI (`0x72`)

Vendor mobile screenshot: up to **3 schedules** with weekdays, time window (`HH:MM-HH:MM`), map coordinates (`b22.581668,113.919415`), and WiFi SSID (`Topin-5G`). Maps to protocol `0x72` ASCII rules in the PDF (`;`, `|`, `,` separators).

**Implementation:** uplink events `7878027201` / `7878027200` parsed; **setting** schedules is **Raw** only (`POST /api/g365/commands/raw` with PDF hex) — no PetPal UI yet.

Re-extract figures locally:

```bash
python tracker-tcp-server/scripts/extract-g365-docx.py
# → tracker-tcp-server/docs/g365-docx-extract/media/
```

---

## Logic we follow (verified against spec + figures)

| Rule | Implementation |
|------|----------------|
| Frame ends at `0D0A` only after full length / WiFi-LBS parse (not on embedded `0D0A`) | `extractFramesFromStream()` |
| Standard length = protocol byte + payload bytes | `tryStandardFrameLength()` |
| WiFi/LBS (`0x17`, `0x18`–`0x1B`, `0x69`): byte 2 = WiFi count, not packet length | `tryWifiLbsFrameLength()` |
| Login IMEI = 8-byte BCD | `decodeImeiBcd()` |
| GPS `0x10`/`0x11`: coords = `(minutes × 30000)` → degrees; GMT0 datetime bytes | `parseG365GpsBody()` |
| WiFi/LBS datetime = 6-byte BCD `YYMMDDHHmmss` | `parseG365BcdDateTime()` |
| WiFi AP = 6-byte BSSID + 1-byte RSSI | `parseWifiBssids()` |
| 2G LBS cell = LAC 2 + CellID 2 + RSSI 1 (5 bytes) | `lbsCellSize()` for `0x17`/`0x69` |
| 4G LBS cell = LAC 4 + CellID 4 + RSSI 1 (9 bytes) | `lbsCellSize()` for `0x18`–`0x1B` |
| Required server ACKs (device disconnects if missing): `0x01`, `0x10`, `0x11`, `0x13`, `0x17`, `0x69` (+ `0x18`–`0x1B`) | `buildG365AckForParsed()` |
| Login ACK: `787801010D0A` (or `787801440D0A` reject) | `buildG365LoginAck()` |
| After login: server sends expiry `7878 0430 YYYYMMDD 0D0A` (length byte may differ) | `buildG365ExpiryDate()` on login in `g365Handler.js` |
| Length byte often wrong for login/heartbeat — parse by data format, not length | `tryFormatBasedFrameLength()` |
| GPS/WiFi ACK: `787800` + protocol + 6-byte device time + `0D0A` | `buildG365TimestampAck()` |
| Status ACK: echo received frame | `buildG365EchoFrame()` |
| Time sync reply: GMT+0, 2-byte year BE + month/day/hour/min/sec bytes | `buildG365TimeAck()` |
| IMEI on session: login `0x01`, then bind socket for later packets without IMEI | `g365Handler.js` |

**Known spec quirks**

- PDF sample GPS frame uses length `0x12` but body needs `0x13` — we parse by footer + structure; real devices should send consistent lengths.
- Length byte is often “not the actual length” per PDF notes — we validate `0D0A` at computed boundaries.
- `0x69` optional ACK #2 (ASCII lat/lng) is **not** used — we use default timestamp ACK only (spec default).

---

## Coverage matrix

Legend:

- **Full** — parse/ACK (uplink) or HTTP API (downlink)
- **Parse** — uplink logged and stored; no dedicated HTTP wrapper
- **ACK** — we reply correctly; minimal parsing
- **Raw** — send via `POST /api/g365/commands/raw` with hex from PDF
- **No** — not implemented (PetPal pet collar scope)

### Minimum location stack (spec §9)

| Proto | Direction | Name | Status |
|-------|-----------|------|--------|
| `0x01` | Device → server | Login | **Full** |
| `0x08` | Device → server | Heartbeat | **Full** |
| `0x10` | Device → server | GPS online | **Full** (+ altitude/alarm V1.2) |
| `0x11` | Device → server | GPS offline | **Full** |
| `0x13` | Device → server | Status | **Full** (basic, charging, extended health/steps per PDF figure 1) |
| `0x17` | Device → server | Offline WiFi/LBS | **Full** |
| `0x30` | Both | Time sync / expiry | **Full** (sync ACK; expiry via HTTP) |
| `0x69` | Device → server | Online WiFi/LBS | **Full** |
| `0x57` | Both | Settings sync | **Parse** uplink request only; no settings payload reply |

### Device → server (other uplinks)

| Proto | Name | Status |
|-------|------|--------|
| `0x14` | Sleep / disconnect | **Parse** |
| `0x15` | Factory reset notice | **ACK** (echo) |
| `0x41`–`0x43` | SOS / dad / mom call request | **Parse** (logged as unparsed if not extended) |
| `0x54` | Daily step count | **ACK** (echo) + parse |
| `0x56` | Wear / remove alarm | **Parse** |
| `0x58` | Whitelist sync request | **Parse** (no whitelist reply) |
| `0x64` | Recording status uplink | **Parse** (logged) |
| `0x65` | Voice file chunks (`6868…`) | **No** (needs separate `6868` listener + FTP) |
| `0x67` | Password recovery | **ACK** (echo) |
| `0x72` | WiFi attendance enter/leave | **Parse** |
| `0x73` | Geo-fence alarm | **Parse** (logged) |
| `0x80` | Location upload failure reason | **Parse** |
| `0x81`–`0x83` | Charging events | **Parse** |
| `0x86` | Overspeed alarm uplink | **Parse** |
| `0x94` | Vibration alarm | **Parse** |
| `0x98` | Upload interval sync from SMS | **ACK** (echo) |
| `0x99` | SOS button | **Parse** |
| `0xAA` | AMR file segment | **No** (FTP workflow) |
| `0xB3` | ICCID | **Parse** |
| `0x52` | Device SMS to server | **No** (marked unsupported in PDF) |

### Server → device (commands)

| Proto | Name | HTTP API | Status |
|-------|------|----------|--------|
| `0x05` | Monitor call mode | — | **Raw** |
| `0x13` | Status interval (min) | `POST …/status-interval` | **Full** |
| `0x13` | Heartbeat interval (sec) | `POST …/heartbeat-interval` | **Full** |
| `0x16` | Whitelist count → triggers `0x58` | — | **Raw** |
| `0x30` | Expiry date | `POST …/expiry-date` | **Full** |
| `0x31` | Validity (same as `0x30` expiry) | `POST …/expiry-date` | **Full** |
| `0x33` | Prohibit LBS | `POST …/prohibit-lbs` | **Full** |
| `0x34` | GPS/LBS/power schedule | — | **Raw** (complex 14-byte payload) |
| `0x40` | Monitor number | `POST …/phone` `role=monitor` | **Full** |
| `0x41`–`0x43` | SOS / dad / mom numbers | `POST …/phone` | **Full** |
| `0x44` | Stop all uploads | — | **Raw** |
| `0x46` | GPS quiet hours | — | **Raw** |
| `0x47` | Do-not-disturb schedule | — | **Raw** |
| `0x48` | Restart / shutdown | `POST …/power` | **Full** |
| `0x49` | Find device (speaker) | `POST …/find` | **Full** |
| `0x50` | Alarm clocks | — | **Raw** |
| `0x57` | Full settings blob | — | **No** (large config; use vendor portal or raw) |
| `0x58` | Whitelist reply | — | **No** |
| `0x54` | Request health refresh | — | **Raw** |
| `0x61` | Light / LED | — | **Raw** |
| `0x64` | Photo / video / record | — | **Raw** (+ FTP for files) |
| `0x66` | Server IP + port | `POST …/server-redirect` | **Full** |
| `0x72` | WiFi attendance rules | — | **Raw** |
| `0x80` | Manual position | `POST …/manual-position` | **Full** |
| `0x86` | Overspeed limit | `POST …/overspeed` | **Full** |
| `0x92`–`0x93` | Vibration alarm on/off | — | **Raw** |
| `0x97` | Upload interval | `POST …/upload-interval` | **Full** |
| `0xF2` | Server-initiated SMS | — | **No** (PDF: not supported) |
| `0x51` | Push voice file to device | — | **No** (FTP + vendor voice host) |

**Any PDF frame:** `POST /api/g365/commands/raw` `{ "imei": "…", "hex": "7878…0D0A" }`

---

## HTTP API summary

Base: same host as tracker HTTP (`HTTP_PORT`, default 5002).

| Method | Path | Body |
|--------|------|------|
| GET | `/api/g365` | — (lists commands) |
| POST | `/api/g365/commands/server-redirect` | `{ imei, host, port? }` |
| POST | `/api/g365/commands/manual-position` | `{ imei, mode?: "gps"\|"wifi" }` |
| POST | `/api/g365/commands/upload-interval` | `{ imei, seconds }` (10–7200) |
| POST | `/api/g365/commands/status-interval` | `{ imei, minutes }` |
| POST | `/api/g365/commands/heartbeat-interval` | `{ imei, seconds }` (20–600) |
| POST | `/api/g365/commands/prohibit-lbs` | `{ imei, enabled: true\|false }` |
| POST | `/api/g365/commands/power` | `{ imei, operation: "restart"\|"shutdown" }` |
| POST | `/api/g365/commands/find` | `{ imei, start: true\|false }` |
| POST | `/api/g365/commands/overspeed` | `{ imei, kmh }` |
| POST | `/api/g365/commands/phone` | `{ imei, role: "sos"\|"dad"\|"mom"\|"monitor", number }` |
| POST | `/api/g365/commands/expiry-date` | `{ imei, yyyymmdd }` |
| POST | `/api/g365/commands/raw` | `{ imei, hex }` |

Device must be **online on port 5003** for commands (503 if offline).

---

## PetPal app integration

- Parsed GPS → `/api/app/position` (`lat`/`lng`, speed, satellites).
- WiFi scans → `wifiBssids`, `atHomeWifi: true` (no coords until home saved or geocoding).
- LBS → `source: "lbs"`, raw cell data in store (no automatic geocoding).
- Same SQLite DB as Xexun; device records include `provider: "g365"`.

---

## Not in scope (by design)

- **FTP / `0x65` / `0xAA` / `0x51` voice** — requires FTP server and vendor file naming.
- **Full `0x57` settings download** — large binary blob; use manufacturer portal or raw hex.
- **Whitelist `0x58` reply** — needs stored contact list UI.
- **LBS geocoding on server** — optional future; spec allows ASCII coord ACK for `0x69` we do not send.
- **Healthcare bracelet `0x13` health fields** — PDF figure 1 layout is parsed on regular trackers too if firmware sends it; heart rate/temperature stored in `statusDetail` only.

---

## Deploy checklist

```bash
ufw allow 5003/tcp
# PM2 env: GPS365_TCP_PORT=5003, GPS365_TCP_ENABLED=1
pm2 restart tracker
```

Point device with SMS/tool or `POST /api/g365/commands/server-redirect` to your public IP **:5003**.
