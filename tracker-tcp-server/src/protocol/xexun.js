function toHex(buf) {
  return Buffer.from(buf).toString("hex").toUpperCase();
}

function decodeImeiFromBcd(imei8) {
  // Common Xexun-style devices encode IMEI in 8 bytes BCD.
  // Example bytes: 08 69 46 90 88 34 46 08 => "869469088344608"
  const digits = [];
  for (const b of imei8) {
    const hi = (b >> 4) & 0x0f;
    const lo = b & 0x0f;
    digits.push(hi, lo);
  }
  // Remove padding nibble if present (often leading 0).
  while (digits.length > 0 && digits[0] === 0) digits.shift();
  return digits.join("").slice(0, 15);
}

const { crc16ccittFalse, u16be } = require("./crc16x25");

function parseDeviceStatusBlock(block) {
  // Heuristic parser based on the packet breakdown you shared:
  // 6A <len=0x18>:
  // battery(1) networkDuration(2) charging(1) steps(2) reserved(...) batteryTime(4) deviceState(1) [etc]
  //
  // This is intentionally defensive: it returns whatever it can.
  const out = {};
  if (!Buffer.isBuffer(block)) return out;

  if (block.length >= 1) out.battery = block.readUInt8(0);
  if (block.length >= 3) out.networkDuration = block.readUInt16BE(1);
  if (block.length >= 4) out.chargingStatus = block.readUInt8(3);
  if (block.length >= 6) out.steps = block.readUInt16BE(4);

  // Try to find a plausible UNIX timestamp (seconds) inside the block.
  // In your screenshots it looked like 0x69FA2C81 which is a valid epoch seconds range.
  for (let i = 0; i + 4 <= block.length; i++) {
    const v = block.readUInt32BE(i);
    if (v >= 1500000000 && v <= 2200000000) {
      out.timestamp = new Date(v * 1000).toISOString();
      out.timestampRaw = v;
      out.timestampBytes = block.subarray(i, i + 4);
      break;
    }
  }

  // Often the last byte is a small device state flag.
  if (block.length >= 1) out.deviceState = block.readUInt8(block.length - 1);
  return out;
}

function findTypedBlock(payload, typeByte) {
  // Payload contains one or more blocks:
  // <type:1> <len:1> <data:len> ...
  for (let i = 0; i + 2 <= payload.length; i++) {
    if (payload.readUInt8(i) !== typeByte) continue;
    const len = payload.readUInt8(i + 1);
    const start = i + 2;
    const end = start + len;
    if (end <= payload.length) return payload.subarray(start, end);
  }
  return null;
}

function parseGpsBlock(block) {
  // The GPS block format varies by model. In your screenshots LAT/LON were shown as
  // decimal degrees and the underlying bytes strongly resemble IEEE754 doubles.
  //
  // Strategy:
  // - scan for two consecutive big-endian doubles that look like (lat, lon)
  // - optionally extract a plausible epoch seconds timestamp (uint32 BE)
  const out = {};
  if (!Buffer.isBuffer(block) || block.length < 16) return out;

  // timestamp (epoch seconds) often appears in the first 4-6 bytes
  for (let i = 0; i + 4 <= Math.min(block.length, 12); i++) {
    const v = block.readUInt32BE(i);
    if (v >= 1500000000 && v <= 2200000000) {
      out.timestampRaw = v;
      out.timestamp = new Date(v * 1000).toISOString();
      break;
    }
  }

  let best = null;
  for (let i = 0; i + 16 <= block.length; i++) {
    const lat = block.readDoubleBE(i);
    const lon = block.readDoubleBE(i + 8);
    const ok =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180;
    if (!ok) continue;

    // Prefer typical pet tracker ranges (not 0/0), but still accept them if that's all.
    const score =
      (Math.abs(lat) < 0.00001 && Math.abs(lon) < 0.00001 ? 0 : 10) +
      (Math.abs(lat) > 1 ? 2 : 0) +
      (Math.abs(lon) > 1 ? 2 : 0);
    if (!best || score > best.score) best = { lat, lon, offset: i, score };
  }

  if (best) {
    out.lat = best.lat;
    out.lng = best.lon;
    out._offset = best.offset;
  }

  // Try to find a small speed value (km/h) as uint16 near the end
  for (let i = Math.max(0, block.length - 10); i + 2 <= block.length; i++) {
    const s = block.readUInt16BE(i);
    if (s > 0 && s < 5000) {
      out.speedKmh = s / 10; // many protocols store speed*10
      break;
    }
  }

  return out;
}

function extractTypedValue(payload, typeByte) {
  const b = findTypedBlock(payload, typeByte);
  if (!b || b.length === 0) return null;
  return b.readUInt8(0);
}

function isValidCrc(packet) {
  // Per your verified samples, CRC is CRC-16/CCITT-FALSE computed over exactly `length`
  // bytes starting at Protocol Version (offset 3). CRC is stored big-endian.
  if (!Buffer.isBuffer(packet) || packet.length < 7) {
    return { ok: false, length: null, computed: null, expected: null };
  }
  if (packet.readUInt8(0) !== 0xfc) {
    return { ok: false, length: null, computed: null, expected: null };
  }
  const length = packet.readUInt16BE(1);
  const total = length + 6; // FC + len(2) + [len bytes] + CRC(2) + CF
  if (packet.length < total) {
    return { ok: false, length, computed: null, expected: null };
  }
  const crcOffset = 3 + length;
  const expected = packet.readUInt16BE(crcOffset);
  const data = packet.subarray(3, 3 + length);
  const computed = crc16ccittFalse(data);
  return { ok: computed === expected, length, computed, expected };
}

function parseXexunPacket(packet) {
  // Expected framing: FC ... CF
  // Structure observed in your sample:
  // FC [len:2] [ver:1] [msgId:1] [seq:1] [imei:8 BCD] [payload...] [crc:2] CF
  if (!Buffer.isBuffer(packet) || packet.length < 1) return null;
  if (packet.readUInt8(0) !== 0xfc) return null;
  if (packet.readUInt8(packet.length - 1) !== 0xcf) return null;

  if (packet.length < 1 + 2 + 1 + 1 + 1 + 8 + 2 + 1) return null;

  const length = packet.readUInt16BE(1); // bytes 2–3 in your docs
  const version = packet.readUInt8(3);
  const messageId = packet.readUInt8(4);
  const sequence = packet.readUInt8(5);
  const imei8 = packet.subarray(6, 14);
  const imei = decodeImeiFromBcd(imei8);

  const total = length + 6;
  const crcOffset = 3 + length;
  const crc = packet.subarray(crcOffset, crcOffset + 2);

  // Payload is the remainder of the `length` bytes after fixed header within that window.
  const payloadLen = Math.max(0, length - (1 + 1 + 1 + 8)); // ver + msgId + seq + imei
  const payloadStart = 14;
  const payloadEnd = payloadStart + payloadLen;
  const payload = packet.subarray(payloadStart, payloadEnd);

  // Xexun devices often use a container messageId (e.g. 0x20) with typed blocks.
  // Some models also put status directly under a dedicated messageId; support both.
  const deviceStatusBlock =
    messageId === 0x6a ? payload : findTypedBlock(payload, 0x6a);
  const gpsBlock = findTypedBlock(payload, 0x64);
  const gps = gpsBlock ? parseGpsBlock(gpsBlock) : null;

  const signal =
    // Some packets carry signal as a separate typed block (seen as "Communication Signal").
    extractTypedValue(payload, 0x12) ??
    extractTypedValue(payload, 0x14) ??
    (deviceStatusBlock && deviceStatusBlock.length >= 8
      ? deviceStatusBlock.readUInt8(7)
      : null);

  const crcCheck = isValidCrc(packet.subarray(0, total));

  const parsed = {
    header: "FC",
    length,
    version,
    messageId,
    sequence,
    imei,
    crc: toHex(crc),
    crcOk: crcCheck.ok,
    crcSpec: { algo: "CRC-16/CCITT-FALSE", endian: "be", coverage: "ver..(len bytes)" },
    rawHex: toHex(packet),
    receivedAt: new Date().toISOString(),
    deviceStatus: deviceStatusBlock ? parseDeviceStatusBlock(deviceStatusBlock) : null,
    gpsRaw: gpsBlock ? toHex(gpsBlock) : null,
    gps,
    signal,
    _payload: payload
  };

  return parsed;
}

function buildAck({ version = 0x03, messageId, sequence, imei8, fixedReply }) {
  // ACK format based on your screenshots:
  // FC <len:2> <ver:1> <msgId:1> <seq:1> <imei8> <fixedReply:n> <crc:2> CF
  //
  // fixedReply is commonly 5 bytes (the platform shows "fixed reply mark").
  const fixed = Buffer.from(fixedReply ?? [0x00]);
  const length = 1 + 1 + 1 + 8 + fixed.length; // ver + msgId + seq + imei + fixed
  const buf = Buffer.alloc(1 + 2 + 1 + 1 + 1 + 8 + fixed.length + 2 + 1);
  let o = 0;
  buf.writeUInt8(0xfc, o++);
  buf.writeUInt16BE(length & 0xffff, o);
  o += 2;
  buf.writeUInt8(version, o++);
  buf.writeUInt8(messageId ?? 0x20, o++);
  buf.writeUInt8(sequence ?? 0x00, o++);
  Buffer.from(imei8 ?? Buffer.alloc(8)).copy(buf, o);
  o += 8;
  fixed.copy(buf, o);
  o += fixed.length;

  // CRC-16/CCITT-FALSE over the `length` bytes starting at version (offset 3)
  const crcVal = crc16ccittFalse(buf.subarray(3, 3 + length));
  const crcBytes = u16be(crcVal);
  crcBytes.copy(buf, o);
  o += 2;
  buf.writeUInt8(0xcf, o++);
  return buf;
}

module.exports = {
  parseXexunPacket,
  buildAck,
  decodeImeiFromBcd,
  toHex,
  isValidCrc,
  detectCrcSpec: () => ({ algo: "CRC-16/CCITT-FALSE" })
};

