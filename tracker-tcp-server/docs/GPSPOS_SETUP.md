# gpspos.net cloud tracker setup

Some pet GPS collars report to a **gpspos-style cloud platform** (JSONP API at `AppJson.asp`). They do **not** speak the Xexun (`FC…CF`) or 365GPS (`7878…0D0A`) TCP protocols used by your other collars.

PetPal integrates these devices by **polling the platform API** and storing the latest fix in the same SQLite/memory store as TCP collars.

## 1. Device / SIM configuration

On the manufacturer app or SMS portal:

1. Register the collar on the platform (you need a **platform account** — username + password).
2. Note the device **IMEI** shown in the app. The API may use a short ID (e.g. `00012836`) or the full 15-digit IMEI — use whichever `Proc_GetLastPosition` accepts.
3. Ensure the SIM has data and the device is **online on the platform** (not only on PetPal).

You do **not** point these collars at `116.203.209.68:5001` or `:5003` unless the manufacturer explicitly supports custom IP redirect (this API doc does not cover that).

## 2. Server environment

On `tracker-tcp-server` (PM2 / `.env`):

```env
GPSPOS_ENABLED=1
GPSPOS_API_URL=https://www.gpspos.net/AppJson.asp
GPSPOS_USER=Sotiris
GPSPOS_PASSWORD=your_password
GPSPOS_DEVICE_IDS=861397052428990
GPSPOS_IMEI_MAP=861397052428990:9705242899

# Poll every 60 seconds (0 = manual sync only)
GPSPOS_POLL_INTERVAL_SEC=60
```

Restart the server:

```bash
cd tracker-tcp-server
npm test
pm2 restart tracker
```

## 3. Manual sync (testing)

```bash
curl -X POST http://127.0.0.1:5002/api/gpspos/sync \
  -H "Content-Type: application/json" \
  -d "{\"imei\":\"861234567890123\"}"
```

Import history (UTC unix seconds):

```bash
curl -X POST http://127.0.0.1:5002/api/gpspos/sync/history \
  -H "Content-Type: application/json" \
  -d "{\"imei\":\"861234567890123\",\"fromUnix\":1704067200,\"toUnix\":1704153600}"
```

## 4. PetPal app

1. Enter the same **IMEI** on the pet’s Tracker tab.
2. Ensure `REACT_APP_XEXUN_HTTP_BASE_URL` points at your tracker server (e.g. `http://116.203.209.68:5002`).
3. On the **Device** tab, cloud collars show **Refresh from cloud** instead of collar TCP commands.

Live/history maps use `/api/app/position` and `/api/app/history` like other devices.

## 5. API reference (vendor)

| Command | Purpose |
|---------|---------|
| `Proc_Login` | Account login |
| `Proc_GetCarInfo` | Device metadata by platform ID |
| `Proc_GetLastPosition` | Latest fix (`dbLat`, `dbLon`, `nTime`, `nSpeed`, …) |
| `Proc_GetTrack` | History between UTC unix times |

Position invalid when `nTEState & 0x80`. Coordinates are WGS84 degrees; some maps in China apply extra correction.

## 6. Troubleshooting

| Symptom | Check |
|---------|--------|
| `gpspos_disabled` | `GPSPOS_ENABLED=1` and restart |
| `gpspos_sync_failed` | Credentials, API URL, device registered on platform |
| `no_position` | Device never reported to platform, or wrong IMEI / map |
| App shows old data | Poll interval, or tap **Refresh from cloud** on Device tab |
