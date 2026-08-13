/**
 * Concox GT06 (and compatible GPSPOS / GT02-style) TCP protocol.
 *
 * Frame: 78 78 | LEN | PROTOCOL | CONTENT… | SERIAL(2) | CRC(2) | 0D 0A
 * LEN = Protocol + Content + Serial + CRC  (= 5 + content length)
 * CRC-ITU over Packet Length … Serial Number (inclusive).
 *
 * Protocol numbers (vendor PDF):
 *   0x01 login
 *   0x12 location (GPS + LBS)
 *   0x13 heartbeat / status
 *   0x15 string / command reply
 *   0x16 alarm (GPS + LBS + status)
 *   0x1A GPS + phone number query
 *   0x80 server → terminal command
 */

const { crc16itu, appendCrcItu } = require("./crc16itu");

const HEADER = 0x7878;
const FOOTER = Buffer.from([0x0d, 0x0a]);

const PROTO = {
  LOGIN: 0x01,
  LOCATION: 0x12,
  STATUS: 0x13,
  STRING: 0x15,
  ALARM: 0x16,
  GPS_PHONE: 0x1a,
  COMMAND: 0x80,
};

/** Voltage level 0–6 → approximate battery percent for PetPal UI. */
const VOLTAGE_LEVEL_TO_PCT = Object.freeze({
  0: 0,
  1: 5,
  2: 15,
  3: 30,
  4: 50,
  5: 75,
  6: 100,
});

/** GSM signal strength level 0–4 → 0–100 scale used by the app. */
const GSM_LEVEL_TO_SIGNAL = Object.freeze({
  0: 0,
  1: 20,
  2: 40,
  3: 70,
  4: 100,
});

function toHex(buf) {
  return Buffer.isBuffer(buf) ? buf.toString("hex") : "";
}

function decodeImeiBcd(buf8) {
  if (!Buffer.isBuffer(buf8) || buf8.length < 8) return null;
  let s = "";
  for (let i = 0; i < 8; i++) {
    const b = buf8[i];
    s += ((b >> 4) & 0x0f).toString(10);
    s += (b & 0x0f).toString(10);
  }
  // 15-digit IMEI is stored in 8 BCD bytes with a leading 0 nibble.
  if (s.length === 16 && s.startsWith("0")) s = s.slice(1);
  if (!/^\d{14,16}$/.test(s)) return null;
  return s.slice(0, 15);
}

function rawCoordToDegrees(rawU32) {
  return rawU32 / 30000 / 60;
}

function parseDateTime6(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 6) return null;
  const y = 2000 + buf[0];
  const mo = buf[1];
  const d = buf[2];
  const h = buf[3];
  const mi = buf[4];
  const s = buf[5];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

function parseCourseStatus(twoBytes) {
  const b0 = twoBytes.readUInt8(0);
  const b1 = twoBytes.readUInt8(1);
  // Bit4 GPS positioned; Bit3 West long; Bit2 North lat (1=N, 0=S); bits1–0 + byte2 = course.
  return {
    gpsRealtime: ((b0 >> 5) & 1) === 0,
    gpsPositioned: ((b0 >> 4) & 1) === 1,
    westLongitude: ((b0 >> 3) & 1) === 1,
    southLatitude: ((b0 >> 2) & 1) === 0,
    courseDeg: ((b0 & 0x03) << 8) | b1,
  };
}

function parseTerminalInfoByte(b) {
  const alarmBits = (b >> 3) & 0x07;
  const alarmMap = {
    0: "normal",
    1: "shock",
    2: "power_cut",
    3: "low_battery",
    4: "sos",
  };
  return {
    oilElectricityCut: ((b >> 7) & 1) === 1,
    gpsTrackingOn: ((b >> 6) & 1) === 1,
    terminalAlarm: alarmMap[alarmBits] || "unknown",
    charging: ((b >> 2) & 1) === 1,
    accHigh: ((b >> 1) & 1) === 1,
    activated: (b & 1) === 1,
    raw: b,
  };
}

function parseAlarmLanguage(twoBytes) {
  if (!Buffer.isBuffer(twoBytes) || twoBytes.length < 2) {
    return { alarm: "unknown", alarmCode: null, language: null };
  }
  const code = twoBytes.readUInt8(0);
  const lang = twoBytes.readUInt8(1);
  const alarmNames = {
    0: "normal",
    1: "sos",
    2: "power_cut",
    3: "shock",
    4: "fence_in",
    5: "fence_out",
  };
  return {
    alarm: alarmNames[code] || "unknown",
    alarmCode: code,
    language: lang === 1 ? "zh" : lang === 2 ? "en" : String(lang),
  };
}

function voltageLevelToBattery(level) {
  if (!Number.isFinite(level)) return null;
  if (level in VOLTAGE_LEVEL_TO_PCT) return VOLTAGE_LEVEL_TO_PCT[level];
  if (level < 0) return 0;
  if (level > 6) return 100;
  return null;
}

function gsmLevelToSignal(level) {
  if (!Number.isFinite(level)) return null;
  if (level in GSM_LEVEL_TO_SIGNAL) return GSM_LEVEL_TO_SIGNAL[level];
  return Math.max(0, Math.min(100, Math.round(Number(level) * 25)));
}

/**
 * @param {Buffer} body GPS+LBS body starting at DateTime (no protocol byte)
 * @returns {{ gps: object, lbs: object|null, o: number } | null}
 */
function parseGpsLbsBlock(body) {
  if (!Buffer.isBuffer(body) || body.length < 18) return null;
  let o = 0;
  const timestamp = parseDateTime6(body.subarray(o, o + 6));
  o += 6;
  const lenSat = body.readUInt8(o);
  o += 1;
  const satellites = lenSat & 0x0f;

  let lat = rawCoordToDegrees(body.readUInt32BE(o));
  o += 4;
  let lng = rawCoordToDegrees(body.readUInt32BE(o));
  o += 4;
  const speedKmh = body.readUInt8(o);
  o += 1;
  if (o + 2 > body.length) return null;
  const course = parseCourseStatus(body.subarray(o, o + 2));
  o += 2;

  if (course.southLatitude) lat = -lat;
  if (course.westLongitude) lng = -lng;

  let lbs = null;
  if (body.length >= o + 8) {
    // Location 0x12 has no LBS length byte; Alarm 0x16 has one.
    // Caller may have already consumed LBS length.
    const mcc = body.readUInt16BE(o);
    o += 2;
    const mnc = body.readUInt8(o);
    o += 1;
    const lac = body.readUInt16BE(o);
    o += 2;
    const cellId = body.readUIntBE(o, 3);
    o += 3;
    lbs = { mcc, mnc, lac, cellId };
  }

  return {
    gps: {
      timestamp,
      lat,
      lng,
      speedKmh,
      satellites,
      gpsValid: course.gpsPositioned,
      courseDeg: course.courseDeg,
      realtime: course.gpsRealtime,
    },
    lbs,
    o,
  };
}

function verifyFrameCrc(frame) {
  if (!Buffer.isBuffer(frame) || frame.length < 10) return false;
  if (frame.readUInt16BE(0) !== HEADER) return false;
  if (frame[frame.length - 2] !== 0x0d || frame[frame.length - 1] !== 0x0a) return false;
  const lenByte = frame[2];
  // LEN bytes after length field: protocol…CRC
  const expectedTotal = 2 + 1 + lenByte + 2; // header + len + body + footer
  if (frame.length !== expectedTotal) return false;
  const crcRecv = frame.readUInt16BE(frame.length - 4);
  const crcData = frame.subarray(2, frame.length - 4); // length … serial
  return crc16itu(crcData) === crcRecv;
}

function tryStandardFrameLength(buf, start) {
  if (buf.length < start + 5) return null;
  if (buf.readUInt16BE(start) !== HEADER) return null;
  const lenByte = buf[start + 2];
  const total = 2 + 1 + lenByte + 2;
  if (buf.length < start + total) return null;
  const end = start + total;
  if (buf[end - 2] !== 0x0d || buf[end - 1] !== 0x0a) return null;
  const frame = buf.subarray(start, end);
  if (!verifyFrameCrc(frame)) return null;
  return total;
}

function extractFramesFromStream(buffer) {
  const frames = [];
  let buf = buffer;

  while (buf.length > 0) {
    const start = buf.indexOf(Buffer.from([0x78, 0x78]));
    if (start === -1) return { frames, rest: buf };
    if (start > 0) buf = buf.subarray(start);

    const total = tryStandardFrameLength(buf, 0);
    if (total == null) {
      // Incomplete frame — wait for more data; drop junk if buffer grows too large.
      if (buf.length > 4096) buf = buf.subarray(1);
      return { frames, rest: buf };
    }

    frames.push(Buffer.from(buf.subarray(0, total)));
    buf = buf.subarray(total);
  }

  return { frames, rest: Buffer.alloc(0) };
}

/**
 * @param {Buffer} frame
 * @param {string|null} sessionImei
 */
function parseGt06Packet(frame, sessionImei = null) {
  if (!verifyFrameCrc(frame)) {
    return { ok: false, error: "bad_crc", rawHex: toHex(frame) };
  }

  const protocol = frame[3];
  const serial = frame.readUInt16BE(frame.length - 6);
  const content = frame.subarray(4, frame.length - 6);
  const base = {
    ok: true,
    provider: "gt06",
    protocol,
    messageId: protocol,
    serial,
    rawHex: toHex(frame),
    needsAck: true,
    imei: sessionImei || null,
  };

  if (protocol === PROTO.LOGIN) {
    const imei = decodeImeiBcd(content.subarray(0, 8));
    return {
      ...base,
      kind: "login",
      imei,
      deviceTimeUtc: null,
    };
  }

  if (protocol === PROTO.LOCATION || protocol === PROTO.GPS_PHONE) {
    const block = parseGpsLbsBlock(content);
    if (!block) return { ...base, kind: "location", error: "short_gps_body", needsAck: true };
    const gps = block.gps;
    return {
      ...base,
      kind: "location",
      source: gps.gpsValid ? "gps" : "lbs",
      accuracy: gps.gpsValid ? "high" : "low",
      gpsValid: Boolean(gps.gpsValid),
      gps: {
        lat: gps.lat,
        lng: gps.lng,
        speedKmh: gps.speedKmh,
        timestamp: gps.timestamp,
        satellites: gps.satellites,
        courseDeg: gps.courseDeg,
      },
      location:
        gps.lat != null && gps.lng != null
          ? { lat: gps.lat, lng: gps.lng, source: gps.gpsValid ? "gps" : "lbs" }
          : null,
      lbs: block.lbs,
      speed: gps.speedKmh,
      satellites: gps.satellites,
    };
  }

  if (protocol === PROTO.STATUS) {
    // TerminalInfo(1) Voltage(1) GSM(1) AlarmLang(2)
    if (content.length < 5) return { ...base, kind: "status", error: "short_status" };
    const info = parseTerminalInfoByte(content[0]);
    const voltageLevel = content[1];
    const gsmLevel = content[2];
    const alarmLang = parseAlarmLanguage(content.subarray(3, 5));
    const battery = voltageLevelToBattery(voltageLevel);
    const signal = gsmLevelToSignal(gsmLevel);
    return {
      ...base,
      kind: "status",
      battery,
      signal,
      charging: info.charging,
      deviceStatus: {
        battery,
        signal,
        chargingStatus: info.charging,
        voltageLevel,
        gsmLevel,
        terminalInfo: info,
        alarm: alarmLang.alarm,
        language: alarmLang.language,
      },
      statusDetail: {
        battery,
        signal,
        charging: info.charging,
        voltageLevel,
        gsmLevel,
        alarm: alarmLang.alarm,
      },
    };
  }

  if (protocol === PROTO.ALARM) {
    // DateTime…GPS… then LBS length (1) + LBS + TerminalInfo + Voltage + GSM + AlarmLang
    if (content.length < 28) return { ...base, kind: "alarm", error: "short_alarm" };
    let o = 0;
    const timestamp = parseDateTime6(content.subarray(o, o + 6));
    o += 6;
    const lenSat = content.readUInt8(o);
    o += 1;
    const satellites = lenSat & 0x0f;
    let lat = rawCoordToDegrees(content.readUInt32BE(o));
    o += 4;
    let lng = rawCoordToDegrees(content.readUInt32BE(o));
    o += 4;
    const speedKmh = content.readUInt8(o);
    o += 1;
    const course = parseCourseStatus(content.subarray(o, o + 2));
    o += 2;
    if (course.southLatitude) lat = -lat;
    if (course.westLongitude) lng = -lng;

    const lbsLen = content.readUInt8(o);
    o += 1;
    void lbsLen;
    const mcc = content.readUInt16BE(o);
    o += 2;
    const mnc = content.readUInt8(o);
    o += 1;
    const lac = content.readUInt16BE(o);
    o += 2;
    const cellId = content.readUIntBE(o, 3);
    o += 3;

    const info = parseTerminalInfoByte(content[o]);
    o += 1;
    const voltageLevel = content[o];
    o += 1;
    const gsmLevel = content[o];
    o += 1;
    const alarmLang = parseAlarmLanguage(content.subarray(o, o + 2));

    const battery = voltageLevelToBattery(voltageLevel);
    const signal = gsmLevelToSignal(gsmLevel);

    return {
      ...base,
      kind: "alarm",
      source: course.gpsPositioned ? "gps" : "lbs",
      accuracy: course.gpsPositioned ? "high" : "low",
      gpsValid: course.gpsPositioned,
      gps: {
        lat,
        lng,
        speedKmh,
        timestamp,
        satellites,
        courseDeg: course.courseDeg,
      },
      location: { lat, lng, source: course.gpsPositioned ? "gps" : "lbs" },
      lbs: { mcc, mnc, lac, cellId },
      battery,
      signal,
      charging: info.charging,
      alarm: alarmLang.alarm,
      deviceStatus: {
        battery,
        signal,
        chargingStatus: info.charging,
        voltageLevel,
        gsmLevel,
        terminalInfo: info,
        alarm: alarmLang.alarm,
        language: alarmLang.language,
        timestamp,
      },
      speed: speedKmh,
      satellites,
    };
  }

  if (protocol === PROTO.STRING) {
    return {
      ...base,
      kind: "string",
      stringAscii: content.toString("ascii").replace(/[^\x20-\x7E]/g, ""),
      contentHex: toHex(content),
    };
  }

  return {
    ...base,
    kind: "unknown",
    contentHex: toHex(content),
  };
}

/**
 * Build a GT06 server response: 78 78 | 05 | proto | serial | CRC | 0D 0A
 */
function buildGt06Ack(protocol, serial) {
  const body = Buffer.alloc(4);
  body[0] = 0x05; // length
  body[1] = protocol & 0xff;
  body.writeUInt16BE(serial & 0xffff, 2);
  const withCrc = appendCrcItu(body);
  return Buffer.concat([Buffer.from([0x78, 0x78]), withCrc, FOOTER]);
}

function buildGt06AckForParsed(parsed) {
  if (!parsed || parsed.needsAck === false) return null;
  if (parsed.serial == null || parsed.protocol == null) return null;
  // Login / status / alarm / location all use same short ACK with matching protocol + serial.
  if (
    parsed.protocol === PROTO.LOGIN ||
    parsed.protocol === PROTO.LOCATION ||
    parsed.protocol === PROTO.STATUS ||
    parsed.protocol === PROTO.ALARM ||
    parsed.protocol === PROTO.GPS_PHONE
  ) {
    return buildGt06Ack(parsed.protocol, parsed.serial);
  }
  return null;
}

/**
 * Server → terminal ASCII command (protocol 0x80).
 * Content: CommandLength(1) = 4 + asciiLen | ServerFlag(4) | ASCII | Language(2)
 * @param {{ serial: number, serverFlag?: number, command: string, language?: 'zh'|'en' }} opts
 */
function buildGt06Command({ serial, serverFlag = 0, command, language = "en" }) {
  const cmdBuf = Buffer.from(String(command), "ascii");
  const lang = Buffer.from(language === "zh" ? [0x00, 0x01] : [0x00, 0x02]);
  const flag = Buffer.alloc(4);
  flag.writeUInt32BE(serverFlag >>> 0, 0);
  const cmdLen = 4 + cmdBuf.length; // server flag + ascii
  const content = Buffer.concat([Buffer.from([cmdLen & 0xff]), flag, cmdBuf, lang]);
  // LEN = protocol + content + serial + crc
  const lenVal = 1 + content.length + 2 + 2;
  const payload = Buffer.alloc(1 + 1 + content.length + 2);
  payload[0] = lenVal;
  payload[1] = PROTO.COMMAND;
  content.copy(payload, 2);
  payload.writeUInt16BE(serial & 0xffff, 2 + content.length);
  const withCrc = appendCrcItu(payload);
  return Buffer.concat([Buffer.from([0x78, 0x78]), withCrc, FOOTER]);
}

module.exports = {
  PROTO,
  HEADER,
  FOOTER,
  crc16itu,
  decodeImeiBcd,
  extractFramesFromStream,
  verifyFrameCrc,
  parseGt06Packet,
  buildGt06Ack,
  buildGt06AckForParsed,
  buildGt06Command,
  voltageLevelToBattery,
  gsmLevelToSignal,
  toHex,
  VOLTAGE_LEVEL_TO_PCT,
  GSM_LEVEL_TO_SIGNAL,
};
