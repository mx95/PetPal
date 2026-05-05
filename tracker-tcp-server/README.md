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

- `GET /devices` — list latest data for all devices
- `GET /devices/:imei` — latest data for one device
- `GET /position?deviceId=IMEI` — last lat/lng for PetPal / maps (404 if no fix yet)
- `POST /commands/queue` — body `{"imei":"…","command":"…"}` — queue a **0x21** text command (see Xexun API: `ip=…`, `tk=…`, `tz=…`, etc.)
- `POST /commands/ip-transfer` — body `{"imei":"…","host":"your.public.ip.or.dns","port":5001}` — queues `ip=host:port` (**server switch**)
- `GET /commands/pending/:imei` — commands waiting to be sent

Queued commands are sent **once per device uplink** (message type `0x20`): after your ACK, the server transmits **one** pending `0x21` frame on the same TCP connection.

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
