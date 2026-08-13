const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractFramesFromStream,
  parseGt06Packet,
  buildGt06Ack,
  buildGt06AckForParsed,
  buildGt06Command,
  verifyFrameCrc,
  decodeImeiBcd,
  toHex,
  PROTO,
  crc16itu,
} = require("../src/protocol/gt06");
const { appendCrcItu } = require("../src/protocol/crc16itu");

function hex(buf) {
  return Buffer.from(String(buf).replace(/\s+/g, ""), "hex");
}

function frameFromPayload(payloadWithoutCrc) {
  return Buffer.concat([hex("7878"), appendCrcItu(payloadWithoutCrc), hex("0D0A")]);
}

test("gt06 — CRC-ITU matches vendor login ACK (D9 DC)", () => {
  // Length(05) + protocol(01) + serial(0001)
  assert.equal(crc16itu(hex("05 01 00 01")), 0xd9dc);
  assert.equal(toHex(buildGt06Ack(0x01, 1)), "787805010001d9dc0d0a");
});

test("gt06 — login frame IMEI (PDF example) + ACK", () => {
  const frame = hex("78 78 0D 01 01 23 45 67 89 01 23 45 00 01 8C DD 0D 0A");
  assert.equal(verifyFrameCrc(frame), true);

  const { frames, rest } = extractFramesFromStream(frame);
  assert.equal(frames.length, 1);
  assert.equal(rest.length, 0);

  const parsed = parseGt06Packet(frames[0]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.provider, "gt06");
  assert.equal(parsed.kind, "login");
  assert.equal(parsed.imei, "123456789012345");
  assert.equal(parsed.protocol, PROTO.LOGIN);
  assert.equal(parsed.serial, 1);

  const ack = buildGt06AckForParsed(parsed);
  assert.equal(toHex(ack), "787805010001d9dc0d0a");
});

test("gt06 — decodeImeiBcd strips leading 0 nibble", () => {
  assert.equal(decodeImeiBcd(hex("01 23 45 67 89 01 23 45")), "123456789012345");
  assert.equal(decodeImeiBcd(hex("08 68 12 01 50 03 88 50")), "868120150038850");
});

test("gt06 — location 0x12 GPS + LBS", () => {
  // Built from protocol layout: date + GPS + course + MCC/MNC/LAC/Cell (no LBS length byte)
  const content = hex("0B 08 1D 02 2A 17 CF 02 7A C7 EB 0C 46 57 0B 00 14 00 01 CC 00 28 7D 00 1F B0");
  assert.equal(content.length, 26);
  const payload = Buffer.alloc(1 + 1 + content.length + 2);
  payload[0] = 1 + content.length + 2 + 2;
  payload[1] = PROTO.LOCATION;
  content.copy(payload, 2);
  payload.writeUInt16BE(1, 2 + content.length);
  const frame = frameFromPayload(payload);

  assert.equal(verifyFrameCrc(frame), true);
  const parsed = parseGt06Packet(frame, "123456789012345");
  assert.equal(parsed.kind, "location");
  assert.equal(parsed.gpsValid, true);
  assert.ok(parsed.gps.lat > 20 && parsed.gps.lat < 30);
  assert.ok(parsed.gps.lng > 110 && parsed.gps.lng < 120);
  assert.equal(parsed.lbs.mcc, 460);
  const ack = buildGt06AckForParsed(parsed);
  assert.equal(toHex(ack), toHex(buildGt06Ack(PROTO.LOCATION, 1)));
  assert.match(toHex(ack), /^78780512/);
});

test("gt06 — status / heartbeat 0x13 battery + signal", () => {
  const payload = hex("0A 13 40 05 04 00 01 00 01");
  const frame = frameFromPayload(payload);
  assert.equal(verifyFrameCrc(frame), true);

  const parsed = parseGt06Packet(frame, "868120150038850");
  assert.equal(parsed.kind, "status");
  assert.equal(parsed.battery, 75);
  assert.equal(parsed.signal, 100);
  assert.equal(parsed.charging, false);
  assert.equal(parsed.deviceStatus.voltageLevel, 5);
  assert.equal(parsed.deviceStatus.gsmLevel, 4);

  const ack = buildGt06AckForParsed(parsed);
  assert.equal(toHex(ack), toHex(buildGt06Ack(PROTO.STATUS, 1)));
  assert.match(toHex(ack), /^78780513/);
});

test("gt06 — alarm 0x16 GPS + terminal info", () => {
  // Course 00 14 (N/E positioned), LBS length 04… then terminal/voltage/gsm/alarm
  const content = hex(
    "0B 0B 0F 0E 41 3A C8 02 7A C7 FE 0C 46 58 49 00 00 14 04 01 CC 00 28 7D 00 1F B8 40 05 04 00 02"
  );
  assert.equal(content.length, 32);
  const payload = Buffer.alloc(1 + 1 + content.length + 2);
  payload[0] = 0x25;
  payload[1] = PROTO.ALARM;
  content.copy(payload, 2);
  payload.writeUInt16BE(4, 2 + content.length);
  const frame = frameFromPayload(payload);

  assert.equal(verifyFrameCrc(frame), true);
  const parsed = parseGt06Packet(frame, "868120150038850");
  assert.equal(parsed.kind, "alarm");
  assert.ok(parsed.gps.lat != null);
  assert.equal(parsed.battery, 75);
  assert.equal(parsed.signal, 100);
  assert.equal(parsed.deviceStatus.terminalInfo.gpsTrackingOn, true);
  assert.equal(toHex(buildGt06AckForParsed(parsed)).startsWith("78780516"), true);
});

test("gt06 — extractFramesFromStream handles back-to-back packets", () => {
  const login = hex("78 78 0D 01 01 23 45 67 89 01 23 45 00 01 8C DD 0D 0A");
  const status = frameFromPayload(hex("0A 13 40 05 04 00 01 00 02"));
  const { frames, rest } = extractFramesFromStream(Buffer.concat([login, status]));
  assert.equal(frames.length, 2);
  assert.equal(rest.length, 0);
  assert.equal(parseGt06Packet(frames[0]).imei, "123456789012345");
  assert.equal(parseGt06Packet(frames[1], "123456789012345").kind, "status");
});

test("gt06 — incomplete frame waits for more data", () => {
  const partial = hex("78 78 0D 01 01 23 45");
  const { frames, rest } = extractFramesFromStream(partial);
  assert.equal(frames.length, 0);
  assert.equal(rest.length, partial.length);
});

test("gt06 — buildGt06Command wraps ASCII SERVERFLAG + cmd", () => {
  const cmd = buildGt06Command({ serial: 1, serverFlag: 0, command: "DYD#", language: "en" });
  assert.equal(cmd.readUInt16BE(0), 0x7878);
  assert.equal(cmd[3], PROTO.COMMAND);
  assert.equal(verifyFrameCrc(cmd), true);
  assert.ok(toHex(cmd).includes(Buffer.from("DYD#", "ascii").toString("hex")));
});

test("gt06 — demux: CRC-ITU distinguishes GT06 from 365GPS login", () => {
  const { isGt06Frame } = require("../src/tcp/gt06Handler");
  const gt06Login = hex("78 78 0D 01 01 23 45 67 89 01 23 45 00 01 8C DD 0D 0A");
  const g365Login = hex("78780A010123456789012345010D0A");
  assert.equal(isGt06Frame(gt06Login), true);
  assert.equal(isGt06Frame(g365Login), false);
});
