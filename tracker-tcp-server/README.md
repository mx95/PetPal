# Tracker TCP Server (Xexun)

This service accepts raw TCP connections from Xexun-style GPS trackers, logs and parses incoming `FC ... CF` HEX packets, sends an ACK reply, and exposes a small HTTP API for the latest device data.

## Run

```powershell
cd tracker-tcp-server
npm install
npm start
```

## Ports

- TCP: `5001` (override with `TCP_PORT`)
- HTTP: `5002` (override with `HTTP_PORT`)

## HTTP API

- `GET /devices` -> list latest data for all devices
- `GET /devices/:imei` -> latest data for one device

## Notes

- The `6A` (device status) parsing is **heuristic** based on the packet breakdown you shared.
- The ACK currently uses a placeholder CRC (`0000`). If your device shows "reply error", we’ll implement the exact CRC algorithm used by this protocol.

