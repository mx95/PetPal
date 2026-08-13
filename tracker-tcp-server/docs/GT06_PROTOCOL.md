# GT06 TCP protocol (GPSPOS direct)

Concox-compatible **GT06** framing for collars that speak the vendor GT06 packet set (including many **GPSPOS**-sold units when redirected off gpspos.net).

Vendor PDF: [GT06_protocol.pdf](./GT06_protocol.pdf)

## Port

**GT06 shares TCP port 5003** with 365GPS (`GPS365_TCP_PORT`).

Both use `7878 … 0D0A`, but message IDs and ACK rules differ. The listener demuxes by **CRC-ITU**:

| | 365GPS | GT06 |
|--|--------|------|
| Detection | Frame does **not** pass CRC-ITU | Frame **passes** CRC-ITU (length…serial) |
| Login ACK | Short 365GPS ACK (+ optional expiry/time) | `78780501` + serial + CRC-ITU |
| GPS | `0x10` / `0x11` (and variants) | `0x12` location |
| Heartbeat | Device-specific | `0x13` status (needs ACK) |

Point GT06 / GPSPOS hardware at **TCP port 5003** (same as 365GPS). An optional dedicated port (`GT06_TCP_PORT`, default 5004) exists only if `GT06_TCP_ENABLED=1`.

## Frame layout

```
78 78 | LEN | PROTOCOL | CONTENT… | SERIAL (2) | CRC (2) | 0D 0A
```

- **LEN** = protocol + content + serial + CRC (= `5 + content.length`)
- **CRC** covers `LEN … SERIAL` inclusive

## Protocols handled

| ID | Kind | Server response |
|----|------|-----------------|
| `0x01` | Login (IMEI BCD) | ACK `0x01` + same serial |
| `0x12` | Location (GPS + LBS) | ACK `0x12` |
| `0x13` | Status / heartbeat | ACK `0x13` |
| `0x15` | String / command reply | (logged; no short ACK) |
| `0x16` | Alarm (GPS + status) | ACK `0x16` |
| `0x1A` | GPS + phone | ACK `0x1A` |
| `0x80` | Server → terminal command | Built by `buildGt06Command` |

## Server config

```env
GPS365_TCP_ENABLED=1
GPS365_TCP_PORT=5003
# Optional second listener (normally leave off):
GT06_TCP_ENABLED=0
```

Firewall must allow inbound **TCP 5003**.

On ingest, GT06 devices are stored with `provider: "gt06"`. Admin override: `PATCH /api/admin/devices/:imei` `{ "providerOverride": "gt06" }`.

## Pointing a GPSPOS collar at PetPal

1. Open port **5003** on the tracker host.
2. On the collar / SMS / vendor app, set server IP to your public host and port **5003**.
3. Wait for a login (`0x01`) then location/status packets (`[GT06]` in logs).
4. In `/admin/devices`, confirm observed provider **gt06** (or set override).
5. Use the same PetPal map APIs: `/api/app/position`, `/api/app/history`.

Devices that **remain** on gpspos.net can keep using cloud poll (`provider: gpspos`). Direct TCP and cloud poll are independent.

## Implementation

- Protocol: `src/protocol/gt06.js`, CRC: `src/protocol/crc16itu.js`
- Demux on 5003: `src/tcp/g365Handler.js` → `isGt06Frame` / `processGt06Frame`
- Optional dedicated listener: `src/tcp/gt06Handler.js`
- Tests: `test/gt06.test.js`
