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
  // Observed layout in your live packets (type 0x6A, len 0x18):
  // battery(1)
  // networkDuration(2) BE
  // signal(1)            ("Communication Signal")
  // trackingSeq(1)
  // movement(1)
  // charging(1)
  // steps(2) BE
  // reserved(7)
  // batteryTime(4) BE unix seconds
  // trailing state bytes (often 4x 0x00)
  const out = {};
  if (!Buffer.isBuffer(block)) return out;

  if (block.length >= 1) out.battery = block.readUInt8(0);
  if (block.length >= 3) out.networkDuration = block.readUInt16BE(1);
  if (block.length >= 4) out.signal = block.readUInt8(3);
  if (block.length >= 5) out.trackingSeq = block.readUInt8(4);
  if (block.length >= 6) out.movement = block.readUInt8(5);
  if (block.length >= 7) out.chargingStatus = block.readUInt8(6);
  if (block.length >= 9) out.steps = block.readUInt16BE(7);

  if (block.length >= 20) {
    const v = block.readUInt32BE(16);
    if (v >= 1500000000 && v <= 2200000000) {
      out.timestampRaw = v;
      out.timestamp = new Date(v * 1000).toISOString();
      out.timestampBytes = block.subarray(16, 20);
    }
  }

  if (block.length > 20) out.deviceStateTail = toHex(block.subarray(20));
  return out;
}

const KNOWN_TYPES = new Set([
  0x64, // GPS
  0x67, // LBS / cell positioning (often includes doubles in other packets)
  0x6a, // device status
  0x6c, // wrapper segment (may contain nested TLV)
  0x6e // version / module info
]);

function tryParseTlvAt(payload, i) {
  if (i + 2 > payload.length) return null;
  const type = payload.readUInt8(i);
  if (!KNOWN_TYPES.has(type)) return null;
  const len = payload.readUInt8(i + 1);
  const start = i + 2;
  const end = start + len;
  if (end > payload.length) return null;
  return { type, len, data: payload.subarray(start, end), offset: i, end };
}

function parseLooseTlvChain(payload) {
  // Walk TLV frames from left-to-right. If the next byte isn't a known type,
  // advance one byte to resync (handles nested garbage between real frames).
  const blocks = [];
  let i = 0;
  while (i < payload.length) {
    const hit = tryParseTlvAt(payload, i);
    if (!hit) {
      i += 1;
      continue;
    }
    blocks.push(hit);
    i = hit.end;
  }
  return blocks;
}

function parseStrictTlvChain(payload) {
  const blocks = [];
  let i = 0;
  while (i < payload.length) {
    const hit = tryParseTlvAt(payload, i);
    if (!hit) return { blocks, rest: payload.subarray(i) };
    blocks.push(hit);
    i = hit.end;
  }
  return { blocks, rest: Buffer.alloc(0) };
}

function flattenBlocks(payload, depth = 0, acc = []) {
  const { blocks, rest } = parseStrictTlvChain(payload);
  const top = blocks;

  for (const b of top) {
    acc.push({ ...b, depth });
    if (b.type === 0x6c && b.data && b.data.length) {
      // Nested sections often don't start with a known root type; scan for embedded frames.
      extractEmbeddedTlvBlocks(b.data, depth + 1, acc);
    }
  }

  // Some frames embed extra TLV-ish chunks after the strict chain; scan the tail loosely.
  if (rest.length) {
    const tailBlocks = parseLooseTlvChain(rest);
    for (const b of tailBlocks) {
      acc.push({ ...b, depth });
      if (b.type === 0x6c && b.data && b.data.length) extractEmbeddedTlvBlocks(b.data, depth + 1, acc);
    }
  }
  return acc;
}

function extractEmbeddedTlvBlocks(buf, depth, acc) {
  // Scan for TLV frames embedded inside a wrapper segment.
  const hits = [];
  for (let i = 0; i + 2 < buf.length; i++) {
    const hit = tryParseTlvAt(buf, i);
    if (!hit) continue;
    // Prefer location-bearing types in embedded scans
    if (hit.type === 0x64 || hit.type === 0x67) hits.push(hit);
  }
  hits.sort((a, b) => a.offset - b.offset);
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.offset < lastEnd) continue;
    acc.push({ ...hit, depth });
    lastEnd = hit.end;
  }
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

  if (packet.length < 1 + 2 + 1 + 1 + 1 + 8 + 2 + 1) return null;

  const length = packet.readUInt16BE(1); // bytes 2–3 in your docs
  const total = length + 6;
  if (packet.length < total) return null;
  const frame = packet.subarray(0, total);
  if (frame.readUInt8(total - 1) !== 0xcf) return null;

  const version = frame.readUInt8(3);
  const messageId = frame.readUInt8(4);
  const sequence = frame.readUInt8(5);
  const imei8 = frame.subarray(6, 14);
  const imei = decodeImeiFromBcd(imei8);

  const crcOffset = 3 + length;
  const crc = frame.subarray(crcOffset, crcOffset + 2);

  // Payload is the remainder of the `length` bytes after fixed header within that window.
  // `length` counts bytes starting at Protocol Version (offset 3) through the last payload byte
  // before CRC. That region includes: ver(1) + msgId(1) + seq(1) + imei(8) + payload(...)
  const payloadStart = 14;
  const payloadEnd = crcOffset;
  const payload = frame.subarray(payloadStart, payloadEnd);

  const blocks = flattenBlocks(payload);

  let deviceStatusBlock = null;
  let gpsBlock = null;
  let lbsBlock = null;
  for (const b of blocks) {
    if (b.type === 0x6a) deviceStatusBlock = b.data;
    if (b.type === 0x64) gpsBlock = b.data; // last wins
    if (b.type === 0x67) lbsBlock = b.data; // last wins
  }
  if (!lbsBlock) {
    const idx = payload.indexOf(0x67);
    if (idx !== -1 && idx + 1 < payload.length) {
      const l = payload.readUInt8(idx + 1);
      const end = idx + 2 + l;
      if (end <= payload.length) lbsBlock = payload.subarray(idx + 2, end);
    }
  }
  if (messageId === 0x6a && !deviceStatusBlock) deviceStatusBlock = payload;

  const gpsParsed = gpsBlock ? parseGpsBlock(gpsBlock) : null;
  const lbsParsed = lbsBlock ? parseGpsBlock(lbsBlock) : null;
  const gps =
    gpsParsed && gpsParsed.lat != null && gpsParsed.lng != null
      ? gpsParsed
      : lbsParsed && lbsParsed.lat != null && lbsParsed.lng != null
        ? { ...lbsParsed, source: "lbs" }
        : gpsParsed && Object.keys(gpsParsed).length
          ? { ...gpsParsed, source: "gps-partial" }
          : lbsParsed && Object.keys(lbsParsed).length
            ? { ...lbsParsed, source: "lbs-partial" }
            : null;

  const deviceStatus = deviceStatusBlock ? parseDeviceStatusBlock(deviceStatusBlock) : null;
  const signal = deviceStatus?.signal ?? null;

  const crcCheck = isValidCrc(frame);

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
    rawHex: toHex(frame),
    receivedAt: new Date().toISOString(),
    deviceStatus,
    gpsRaw: gpsBlock ? toHex(gpsBlock) : null,
    lbsRaw: lbsBlock ? toHex(lbsBlock) : null,
    gps,
    signal,
    blocks: blocks.map((b) => ({ type: b.type, len: b.len, depth: b.depth })),
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

