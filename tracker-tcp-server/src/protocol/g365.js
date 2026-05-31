/**
 * 365GPS / Zhongxun locator protocol (7878 … 0D0A).
 * Ref: "365GPS 2G and 4G GPS tracker communication protocol" (2024-07-02).
 */

const { parsedCoordsUsable } = require("../geo/coords");

const HEADER = 0x7878;
const FOOTER = 0x0d0a;

/** Protocols where byte 2 is WiFi hotspot count (not packet length). */
const WIFI_LBS_PROTOCOLS = new Set([0x17, 0x18, 0x19, 0x1a, 0x1b, 0x69]);

/** Device disconnects if these uplinks are not ACKed. */
const MUST_ACK_PROTOCOLS = new Set([0x01, 0x10, 0x11, 0x13, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x69]);

function toHex(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  return buf.toString("hex").toUpperCase();
}

function decodeImeiBcd(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
  let digits = "";
  for (let i = 0; i < 8; i++) {
    const b = buf.readUInt8(i);
    digits += String(b >> 4);
    digits += String(b & 0x0f);
  }
  return digits.replace(/^0+/, "").slice(0, 15) || digits.slice(0, 15);
}

function encodeImeiBcd(imeiStr) {
  const digits = String(imeiStr).replace(/\D/g, "").slice(0, 15);
  const padded = digits.padStart(16, "0");
  const buf = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    const hi = parseInt(padded[i * 2], 10);
    const lo = parseInt(padded[i * 2 + 1], 10);
    buf[i] = ((hi & 0x0f) << 4) | (lo & 0x0f);
  }
  return buf;
}

function parseG365GpsDateTime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 6) return null;
  const year = 2000 + buf.readUInt8(0);
  const month = buf.readUInt8(1);
  const day = buf.readUInt8(2);
  const hour = buf.readUInt8(3);
  const minute = buf.readUInt8(4);
  const second = buf.readUInt8(5);
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function parseG365BcdDateTime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 6) return null;
  const digits = [];
  for (let i = 0; i < 6; i++) {
    const b = buf.readUInt8(i);
    digits.push(String(b >> 4));
    digits.push(String(b & 0x0f));
  }
  const s = digits.join("");
  const year = 2000 + parseInt(s.slice(0, 2), 10);
  const month = parseInt(s.slice(2, 4), 10);
  const day = parseInt(s.slice(4, 6), 10);
  const hour = parseInt(s.slice(6, 8), 10);
  const minute = parseInt(s.slice(8, 10), 10);
  const second = parseInt(s.slice(10, 12), 10);
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function g365RawToDegrees(rawU32) {
  return rawU32 / 30000 / 60;
}

function formatBssid(buf6) {
  return Array.from(buf6)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(":");
}

function lbsCellSize(protocol) {
  return protocol === 0x18 || protocol === 0x19 || protocol === 0x1a || protocol === 0x1b ? 9 : 5;
}

function tryWifiLbsFrameLength(buf, start) {
  if (buf.length < start + 10) return null;
  const protocol = buf.readUInt8(start + 3);
  if (!WIFI_LBS_PROTOCOLS.has(protocol)) return null;

  let o = start + 4 + 6; // after 7878, wifiCount, protocol, datetime
  const wifiCount = buf.readUInt8(start + 2);
  if (wifiCount > 8) return null;

  o += wifiCount * 7;
  if (o >= buf.length) return null;

  const lbsCount = buf.readUInt8(o);
  const is4g = protocol === 0x18 || protocol === 0x19 || protocol === 0x1a || protocol === 0x1b;
  if (lbsCount > (is4g ? 6 : 255)) return null;
  o += 1 + 3 + lbsCount * lbsCellSize(protocol);

  if (o + 2 <= buf.length && buf.readUInt16BE(o) === FOOTER) {
    return o + 2 - start;
  }
  if (o + 3 <= buf.length && buf.readUInt16BE(o + 1) === FOOTER) {
    return o + 3 - start;
  }
  return null;
}

function tryStandardFrameLength(buf, start) {
  if (buf.length < start + 5) return null;
  const contentLen = buf.readUInt8(start + 2);
  if (contentLen === 0) {
    // Some ACKs use length 0 with protocol in byte 3 (7878 00 10 …).
    const total = start + 2 + 1 + 1 + 2;
    if (buf.length < total) return null;
    if (buf.readUInt16BE(total - 2) !== FOOTER) return null;
    return total - start;
  }
  const total = start + 2 + 1 + contentLen + 2;
  if (buf.length < total) return null;
  if (buf.readUInt16BE(total - 2) !== FOOTER) return null;
  return total - start;
}

function tryFormatBasedFrameLength(buf, start) {
  if (buf.length < start + 6) return null;
  if (buf.readUInt16BE(start) !== HEADER) return null;

  const protocol = buf.readUInt8(start + 3);

  // PDF note: length byte often wrong — parse by fixed layout instead.
  if (protocol === 0x01) {
    // Login: 7878 + len + 01 + IMEI(8) + [optional bytes] + 0D0A (typically 15 bytes total).
    for (let total = 14; total <= 20; total++) {
      if (buf.length < start + total) break;
      if (buf.readUInt16BE(start + total - 2) === FOOTER) return total;
    }
    return null;
  }

  // Single-field packets: 7878 01 XX 0D0A (7 bytes) when length byte is also wrong.
  const singleByteTotal = start + 7;
  if (buf.length >= singleByteTotal && buf.readUInt16BE(singleByteTotal - 2) === FOOTER) {
    const contentLen = buf.readUInt8(start + 2);
    if (contentLen === 0x01) return 7;
  }

  return null;
}

function frameLengthAt(buf, start) {
  if (buf.length < start + 4) return null;
  if (buf.readUInt16BE(start) !== HEADER) return null;

  const wifiLen = tryWifiLbsFrameLength(buf, start);
  if (wifiLen != null) return wifiLen;

  const stdLen = tryStandardFrameLength(buf, start);
  if (stdLen != null) return stdLen;

  return tryFormatBasedFrameLength(buf, start);
}

function extractFramesFromStream(buffer) {
  const frames = [];
  let buf = buffer;

  while (buf.length > 0) {
    const start = buf.indexOf(Buffer.from([0x78, 0x78]));
    if (start === -1) return { frames, rest: buf };
    if (start > 0) buf = buf.subarray(start);

    const total = frameLengthAt(buf, 0);
    if (total == null) {
      if (buf.length > 4096) buf = buf.subarray(1);
      return { frames, rest: buf };
    }

    frames.push(Buffer.from(buf.subarray(0, total)));
    buf = buf.subarray(total);
  }

  return { frames, rest: Buffer.alloc(0) };
}

function parseG365CourseStatus(twoBytes) {
  const b0 = twoBytes.readUInt8(0);
  const b1 = twoBytes.readUInt8(1);
  return {
    gpsPositioned: ((b0 >> 2) & 1) === 1,
    westLongitude: ((b0 >> 1) & 1) === 1,
    southLatitude: (b0 & 1) === 1,
    courseDeg: ((b0 & 0x03) << 8) | b1
  };
}

function parseG365GpsBody(body, protocol) {
  if (body.length < 18) return null;
  let o = 0;
  const timestamp = parseG365GpsDateTime(body.subarray(o, o + 6));
  o += 6;
  const lenSat = body.readUInt8(o);
  o += 1;
  const infoLen = lenSat >> 4;
  const satellites = lenSat & 0x0f;
  void infoLen;

  const latRaw = body.readUInt32BE(o);
  o += 4;
  const lngRaw = body.readUInt32BE(o);
  o += 4;
  let lat = g365RawToDegrees(latRaw);
  let lng = g365RawToDegrees(lngRaw);
  const speedKmh = body.readUInt8(o);
  o += 1;
  const course = parseG365CourseStatus(body.subarray(o, o + 2));
  o += 2;

  if (course.southLatitude) lat = -lat;
  if (course.westLongitude) lng = -lng;

  let altitudeM = null;
  let alarmFlags = null;
  if (body.length >= o + 3) {
    altitudeM = body.readUInt16BE(o);
    o += 2;
    alarmFlags = body.readUInt8(o);
    o += 1;
  }

  return {
    timestamp,
    lat,
    lng,
    speedKmh,
    satellites,
    gpsValid: course.gpsPositioned,
    courseDeg: course.courseDeg,
    altitudeM,
    alarmFlags,
    protocol
  };
}

function parseWifiBssids(buf, wifiCount) {
  const out = [];
  let o = 0;
  for (let i = 0; i < wifiCount; i++) {
    if (o + 7 > buf.length) break;
    out.push({
      bssid: formatBssid(buf.subarray(o, o + 6)),
      rssi: buf.readUInt8(o + 6)
    });
    o += 7;
  }
  return out;
}

function parseWifiLbsBody(body, protocol) {
  if (body.length < 7) return null;
  let o = 0;
  const wifiCount = body.readUInt8(o);
  o += 1;
  o += 1; // protocol byte inside body for wifi-style (already known)
  const timestamp = parseG365BcdDateTime(body.subarray(o, o + 6));
  o += 6;

  const wifiRaw = body.subarray(o, o + wifiCount * 7);
  const wifiBssids = parseWifiBssids(wifiRaw, wifiCount);
  o += wifiCount * 7;

  let lbsRaw = null;
  let lbsCount = null;
  if (o < body.length) {
    lbsCount = body.readUInt8(o);
    const cellSize = lbsCellSize(protocol);
    const lbsBytes = 1 + 3 + lbsCount * cellSize;
    if (o + lbsBytes <= body.length) {
      lbsRaw = body.subarray(o, o + lbsBytes);
      o += lbsBytes;
    }
  }

  let alarmFlags = null;
  if (o < body.length) {
    // Optional alarm byte before wire footer (footer is not part of `body`).
    alarmFlags = body.readUInt8(o);
  }

  return {
    timestamp,
    wifiBssids,
    wifiCount,
    lbsCount,
    lbsRaw: lbsRaw ? toHex(lbsRaw) : null,
    alarmFlags,
    protocol
  };
}

function parseStatusBody(body) {
  if (body.length < 5) return null;
  const status = {
    battery: body.readUInt8(0),
    softwareVersion: body.readUInt8(1),
    timezone: body.readUInt8(2),
    uploadIntervalMin: body.readUInt8(3),
    signal: body.readUInt8(4),
    charging: body.length >= 6 ? body.readUInt8(5) === 0x01 : null,
    temperatureRaw: null,
    heartRate: null,
    steps: null,
    activityTimeMin: null,
    timestamp: null,
    variant: "basic"
  };

  // Vendor PDF figure 1 (extended 0x13): battery, version, tz, interval, signal,
  // recharging, temperature (2), heart rate, pedometer (4), activity time (2), date BCD (6).
  if (body.length >= 21) {
    status.variant = "extended";
    status.temperatureRaw = body.readUInt16BE(6);
    status.heartRate = body.readUInt8(8);
    status.steps = body.readUInt32BE(9);
    status.activityTimeMin = body.readUInt16BE(13);
    status.timestamp = parseG365BcdDateTime(body.subarray(15, 21));
  } else if (body.length >= 6) {
    status.variant = "withCharging";
  }

  return status;
}

/**
 * @param {Buffer} frame Full 7878…0D0A frame
 * @param {string|null} sessionImei IMEI learned from 0x01 login on this TCP session
 */
function parseG365Packet(frame, sessionImei = null) {
  if (!Buffer.isBuffer(frame) || frame.length < 5) return null;
  if (frame.readUInt16BE(0) !== HEADER) return null;
  if (frame.readUInt16BE(frame.length - 2) !== FOOTER) return null;

  const wifiLen = tryWifiLbsFrameLength(frame, 0);
  const isWifiStyle = wifiLen != null;

  let protocol;
  let content;
  let dateTime6 = null;

  if (isWifiStyle) {
    protocol = frame.readUInt8(3);
    content = frame.subarray(2, frame.length - 2);
    dateTime6 = frame.subarray(4, 10);
  } else {
    const contentLen = frame.readUInt8(2);
    protocol = frame.readUInt8(3);
    content = frame.subarray(3, 3 + contentLen);
    const payload = content.subarray(1);
    if (protocol === 0x10 || protocol === 0x11) {
      dateTime6 = payload.subarray(0, 6);
    }
  }

  const receivedAt = new Date().toISOString();
  const base = {
    header: "7878",
    protocol,
    messageId: protocol,
    provider: "g365",
    rawHex: toHex(frame),
    receivedAt,
    imei: sessionImei
  };

  if (protocol === 0x01) {
    const payload = isWifiStyle ? content.subarray(2) : content.subarray(1);
    const imei = decodeImeiBcd(payload.subarray(0, 8));
    const softwareVersion = payload.length >= 9 ? payload.readUInt8(8) : null;
    return {
      ...base,
      imei,
      softwareVersion,
      needsAck: true
    };
  }

  if (protocol === 0x08) {
    return { ...base, needsAck: false };
  }

  if (protocol === 0x10 || protocol === 0x11) {
    const payload = content.subarray(1);
    const gps = parseG365GpsBody(payload, protocol);
    if (!gps) return { ...base, needsAck: true, dateTime6 };
    const coordsOk = parsedCoordsUsable(gps) && gps.gpsValid;
    return {
      ...base,
      needsAck: true,
      dateTime6: payload.subarray(0, 6),
      gps: coordsOk
        ? {
            lat: gps.lat,
            lng: gps.lng,
            speedKmh: gps.speedKmh,
            satellites: gps.satellites,
            timestamp: gps.timestamp,
            source: "gps"
          }
        : { lat: null, lng: null, speedKmh: gps.speedKmh, satellites: gps.satellites, timestamp: gps.timestamp },
      gpsValid: coordsOk,
      source: coordsOk ? "gps" : null,
      accuracy: coordsOk ? "gps" : null,
      satellites: gps.satellites,
      deviceStatus: { timestamp: gps.timestamp },
      alarmFlags: gps.alarmFlags,
      altitudeM: gps.altitudeM
    };
  }

  if (protocol === 0x13) {
    const payload = content.subarray(1);
    const status = parseStatusBody(payload);
    return {
      ...base,
      needsAck: true,
      deviceStatus: status
        ? {
            battery: status.battery,
            signal: status.signal,
            chargingStatus: status.charging,
            steps: status.steps ?? null,
            timestamp: status.timestamp ?? null
          }
        : null,
      signal: status?.signal ?? null,
      statusDetail: status
    };
  }

  if (WIFI_LBS_PROTOCOLS.has(protocol)) {
    const wifiLbs = parseWifiLbsBody(content, protocol);
    const bssids = wifiLbs?.wifiBssids?.map((w) => w.bssid) ?? [];
    const hasWifi = bssids.length > 0;
    return {
      ...base,
      needsAck: true,
      dateTime6,
      wifiBssids: hasWifi ? bssids : null,
      wifiMeta: wifiLbs?.wifiBssids ?? null,
      lbsRaw: wifiLbs?.lbsRaw ?? null,
      gps: hasWifi
        ? { source: "wifi", wifiBssids: bssids, atHomeWifi: true, timestamp: wifiLbs?.timestamp ?? null }
        : { source: "lbs", timestamp: wifiLbs?.timestamp ?? null },
      source: hasWifi ? "wifi" : "lbs",
      accuracy: hasWifi ? "wifi" : "lbs",
      gpsValid: false,
      deviceStatus: { timestamp: wifiLbs?.timestamp ?? null },
      alarmFlags: wifiLbs?.alarmFlags ?? null
    };
  }

  if (protocol === 0x14) {
    return { ...base, needsAck: false, sleepMode: true };
  }

  if (protocol === 0x15) {
    return { ...base, needsAck: true, factoryResetNotice: true };
  }

  if (protocol === 0x54) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: true,
      stepsDaily: payload.length >= 7
        ? {
            dateAscii: payload.subarray(0, 4).toString("ascii"),
            totalSteps: payload.readUIntBE(4, 3)
          }
        : null
    };
  }

  if (protocol === 0x56) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: false,
      wearAlarm: payload.length >= 1 ? payload.readUInt8(0) : null
    };
  }

  if (protocol === 0x57) {
    return { ...base, needsAck: false, settingsSyncRequest: true };
  }

  if (protocol === 0x58) {
    return { ...base, needsAck: false, whitelistSyncRequest: true };
  }

  if (protocol === 0x67) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: true,
      passwordRecovery: payload.length >= 1 ? payload.readUInt8(0) : null
    };
  }

  if (protocol === 0x72) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: false,
      attendanceEvent: payload.length >= 1 ? payload.readUInt8(0) : null
    };
  }

  if (protocol === 0x80 && content.length > 1) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: false,
      locationUploadFailure: payload.length >= 1 ? payload.readUInt8(0) : null
    };
  }

  if (protocol === 0x81 || protocol === 0x82 || protocol === 0x83) {
    return {
      ...base,
      needsAck: false,
      chargingEvent: protocol === 0x81 ? "complete" : protocol === 0x82 ? "connected" : "disconnected"
    };
  }

  if (protocol === 0x86) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: false,
      overspeedKmh: payload.length >= 1 ? payload.readUInt8(0) : null
    };
  }

  if (protocol === 0x94) {
    return { ...base, needsAck: false, vibrationAlarm: true };
  }

  if (protocol === 0x98) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: true,
      uploadIntervalSec: payload.length >= 2 ? payload.readUInt16BE(0) : null
    };
  }

  if (protocol === 0x99) {
    return { ...base, needsAck: false, sosAlarm: true };
  }

  if (protocol === 0xb3) {
    const payload = content.subarray(1);
    return {
      ...base,
      needsAck: false,
      iccid: payload.length > 0 ? payload.toString("ascii") : null
    };
  }

  if (protocol === 0x30) {
    const payload = content.subarray(1);
    if (payload.length === 0) {
      return { ...base, needsAck: true, timeSyncRequest: true };
    }
    return { ...base, needsAck: false, expiryDate: payload.toString("ascii") };
  }

  return {
    ...base,
    needsAck: MUST_ACK_PROTOCOLS.has(protocol),
    unparsed: true
  };
}

function utcDateTime6(now = new Date()) {
  return Buffer.from([
    now.getUTCFullYear() - 2000,
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ]);
}

function buildG365LoginAck({ success = true } = {}) {
  const proto = success ? 0x01 : 0x44;
  return Buffer.from([0x78, 0x78, 0x01, proto, 0x0d, 0x0a]);
}

function buildG365TimeAck(now = new Date()) {
  // Spec example 07E00705053718 → year 0x07E0 (2016), month/day/hour/min/sec as hex bytes (GMT+0).
  const dt = Buffer.from([
    (now.getUTCFullYear() >> 8) & 0xff,
    now.getUTCFullYear() & 0xff,
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ]);
  const contentLen = 1 + dt.length;
  return Buffer.concat([
    Buffer.from([0x78, 0x78, contentLen & 0xff, 0x30]),
    dt,
    Buffer.from([0x0d, 0x0a])
  ]);
}

/** ACK for 0x10 / 0x11 / 0x17 / 0x18 / 0x19 / 0x69 — length byte is 0x00 per spec. */
function buildG365TimestampAck(protocol, dateTime6) {
  if (!Buffer.isBuffer(dateTime6) || dateTime6.length !== 6) {
    throw new Error("g365 ACK requires 6-byte device datetime");
  }
  return Buffer.concat([
    Buffer.from([0x78, 0x78, 0x00, protocol & 0xff]),
    dateTime6,
    Buffer.from([0x0d, 0x0a])
  ]);
}

function buildG365EchoFrame(frame) {
  return Buffer.from(frame);
}

/** Server command 0x66 — redirect device to new IP/port (binary IP + port BE). */
function buildG365ServerRedirect({ ip, port }) {
  const parts = String(ip)
    .trim()
    .split(".")
    .map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    throw new Error("invalid IPv4 for g365 redirect");
  }
  const p = Number(port);
  if (!Number.isFinite(p) || p < 1 || p > 65535) throw new Error("invalid port for g365 redirect");
  return Buffer.from([
    0x78,
    0x78,
    0x07,
    0x66,
    parts[0],
    parts[1],
    parts[2],
    parts[3],
    (p >> 8) & 0xff,
    p & 0xff,
    0x0d,
    0x0a
  ]);
}

/** Server command 0x80 — request immediate location upload. */
function buildG365ManualPosition(mode = "gps") {
  if (mode === "wifi") {
    return Buffer.from([0x78, 0x78, 0x02, 0x80, 0x02, 0x0d, 0x0a]);
  }
  return Buffer.from([0x78, 0x78, 0x01, 0x80, 0x0d, 0x0a]);
}

function buildG365EchoProtocol(protocol) {
  return Buffer.from([0x78, 0x78, 0x01, protocol & 0xff, 0x0d, 0x0a]);
}

function buildG365StandardFrame(protocol, payload = Buffer.alloc(0)) {
  const contentLen = 1 + payload.length;
  return Buffer.concat([
    Buffer.from([0x78, 0x78, contentLen & 0xff, protocol & 0xff]),
    payload,
    Buffer.from([0x0d, 0x0a])
  ]);
}

/** Server → device: set status upload interval (minutes). Uses 0x13 subcommand. */
function buildG365StatusInterval(minutes) {
  return buildG365StandardFrame(0x13, Buffer.from([minutes & 0xff]));
}

/** Server → device: set heartbeat interval (seconds, 20–600). Uses 0x13 subcommand. */
function buildG365HeartbeatInterval(seconds) {
  const sec = Math.max(20, Math.min(600, Number(seconds) || 300));
  const payload = Buffer.alloc(2);
  payload.writeUInt16BE(sec, 0);
  return Buffer.from([
    0x78, 0x78, 0x03, 0x13,
    payload[0], payload[1],
    0x0d, 0x0a
  ]);
}

/** Server → device: prohibit LBS uploads (0x33). state 1=on, 0=off. */
function buildG365ProhibitLbs(state) {
  return buildG365StandardFrame(0x33, Buffer.from([state ? 0x01 : 0x00]));
}

/** Server → device: restart (0x48 op 0x01) or shutdown (0x02). */
function buildG365PowerControl(operation) {
  const op = operation === "shutdown" ? 0x02 : 0x01;
  return buildG365StandardFrame(0x48, Buffer.from([op]));
}

/** Server → device: find device speaker (0x49). */
function buildG365FindDevice(start) {
  return buildG365StandardFrame(0x49, Buffer.from([start ? 0x01 : 0x00]));
}

/** Server → device: overspeed threshold km/h (0x86). */
function buildG365OverspeedLimit(kmh) {
  return buildG365StandardFrame(0x86, Buffer.from([Number(kmh) & 0xff]));
}

/** Server → device: positioning upload interval seconds (0x97, 10–7200). */
function buildG365UploadInterval(seconds) {
  const sec = Math.max(10, Math.min(7200, Number(seconds) || 60));
  const payload = Buffer.alloc(2);
  payload.writeUInt16BE(sec, 0);
  return buildG365StandardFrame(0x97, payload);
}

/** Server → device: ASCII phone number command (0x40 SOS, 0x41, 0x42, 0x43, etc.). */
function buildG365PhoneNumber(protocol, phoneAscii) {
  return buildG365StandardFrame(Number(protocol) & 0xff, Buffer.from(String(phoneAscii), "ascii"));
}

/** Server → device: send expiry date after login (0x30 with YYYYMMDD ASCII). */
function buildG365ExpiryDate(yyyymmdd) {
  return buildG365StandardFrame(0x30, Buffer.from(String(yyyymmdd), "ascii"));
}

function buildG365AckForParsed(parsed, frame) {
  if (!parsed?.needsAck) return null;
  const p = parsed.protocol ?? parsed.messageId;
  if (p === 0x01) return buildG365LoginAck({ success: true });
  if (p === 0x30 && parsed.timeSyncRequest) return buildG365TimeAck();
  if (p === 0x13) return buildG365EchoFrame(frame);
  if (p === 0x15 || p === 0x67) return buildG365EchoFrame(frame);
  if (p === 0x54 || p === 0x98) return buildG365EchoFrame(frame);
  if ([0x10, 0x11, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x69].includes(p) && parsed.dateTime6) {
    return buildG365TimestampAck(p, parsed.dateTime6);
  }
  return null;
}

module.exports = {
  HEADER,
  FOOTER,
  WIFI_LBS_PROTOCOLS,
  MUST_ACK_PROTOCOLS,
  toHex,
  decodeImeiBcd,
  encodeImeiBcd,
  extractFramesFromStream,
  frameLengthAt,
  parseG365Packet,
  buildG365LoginAck,
  buildG365TimeAck,
  buildG365TimestampAck,
  buildG365EchoFrame,
  buildG365ServerRedirect,
  buildG365ManualPosition,
  buildG365EchoProtocol,
  buildG365StandardFrame,
  buildG365StatusInterval,
  buildG365HeartbeatInterval,
  buildG365ProhibitLbs,
  buildG365PowerControl,
  buildG365FindDevice,
  buildG365OverspeedLimit,
  buildG365UploadInterval,
  buildG365PhoneNumber,
  buildG365ExpiryDate,
  buildG365AckForParsed
};
