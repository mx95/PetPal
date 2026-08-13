# gpspos.net cloud tracker setup

Some pet GPS collars report to a **gpspos-style cloud platform** (JSONP API at `AppJson.asp`). Those units can stay on the cloud and be polled by PetPal.

Many of the same collars also speak **GT06** over TCP. Prefer pointing them at PetPal directly:

- Protocol notes: [GT06_PROTOCOL.md](./GT06_PROTOCOL.md)
- TCP port **5003** (same as 365GPS; CRC-ITU demux)
- Admin provider **`gt06`**

Use the cloud poll path below only when the collar cannot leave gpspos.net (or while migrating).

## 1. Device / SIM configuration

On the manufacturer app or SMS portal:

1. Register the collar on the platform (you need a **platform account** — username + password).
2. Note the device **IMEI** shown in the app. The API may use a short ID (e.g. `00012836`) or the full 15-digit IMEI — use whichever `Proc_GetLastPosition` accepts.
3. Ensure the SIM has data and the device is **online on the platform** (not only on PetPal).

To use **direct GT06** instead: set the collar server to your public IP and port **5003** (same port as 365GPS). You do not need platform polling for those devices.

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

# Direct GT06 TCP (recommended when firmware allows custom IP — same port as 365GPS)
GPS365_TCP_ENABLED=1
GPS365_TCP_PORT=5003
GT06_TCP_ENABLED=0
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
4. GT06-direct collars use the live TCP position like 365GPS (provider `gt06`).

Live/history maps use `/api/app/position` and `/api/app/history` like other devices.

## 5. API reference (vendor)

| Command | Purpose |
|---------|---------|
| `Proc_Login` | Account login |
| `Proc_GetCarInfo` | Device metadata by platform ID |
| `Proc_GetLastPosition` | Latest fix (`dbLat`, `dbLon`, `nTime`, `nSpeed`, …) |
| `Proc_GetTrack` | History between UTC unix times |

Position invalid when `nTEState & 0x80`. Coordinates are WGS84 degrees; some maps in China apply extra correction.

Charging status is **not** shown for GPSPOS cloud collars — the platform `nTEState` field does not expose a reliable external-power bit for these devices. Use the collar LED or manufacturer app for charge state. GT06-direct status packets (`0x13`) do expose voltage / charging bits.

## 6. Troubleshooting

| Symptom | Check |
|---------|-------|
| Sync returns empty / offline | Device online on gpspos.net? Correct platform IMEI mapping? |
| Want live TCP instead | Open port 5003, redirect collar to GT06, see [GT06_PROTOCOL.md](./GT06_PROTOCOL.md) |
