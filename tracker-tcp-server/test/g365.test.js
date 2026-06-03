const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractFramesFromStream,
  parseG365Packet,
  buildG365LoginAck,
  buildG365TimeAck,
  buildG365TimestampAck,
  buildG365AckForParsed,
  buildG365ExpiryDate,
  decodeImeiBcd,
  toHex
} = require("../src/protocol/g365");

function hex(buf) {
  return Buffer.from(String(buf).replace(/\s+/g, ""), "hex");
}

test("g365 — login frame IMEI + ACK", () => {
  const frame = hex("7878 0A 01 0123456789012345 01 0D0A");
  const { frames, rest } = extractFramesFromStream(frame);
  assert.equal(frames.length, 1);
  assert.equal(rest.length, 0);

  const parsed = parseG365Packet(frames[0]);
  assert.equal(parsed.imei, "123456789012345");
  assert.equal(parsed.protocol, 0x01);
  assert.equal(toHex(buildG365LoginAck()), "787801010D0A");

  const ack = buildG365AckForParsed(parsed, frames[0]);
  assert.equal(toHex(ack), "787801010D0A");
});

test("g365 — login frame with unreliable length byte 0x0D (real device)", () => {
  const frame = hex("78780D010861261021497967080D0A");
  const { frames, rest } = extractFramesFromStream(frame);
  assert.equal(frames.length, 1);
  assert.equal(rest.length, 0);
  assert.equal(frames[0].length, 15);

  const parsed = parseG365Packet(frames[0]);
  assert.equal(parsed.imei, "861261021497967");
  assert.equal(parsed.protocol, 0x01);
  assert.equal(parsed.softwareVersion, 0x08);
  assert.equal(toHex(buildG365AckForParsed(parsed, frames[0])), "787801010D0A");
});

test("g365 — GPS 0x10 example from spec (861261021497967-style standard length)", () => {
  // Vendor PDF lists length 0x12; actual frame needs 0x13 (protocol + 18-byte GPS body).
  const frame = hex("787813100A03170F32179C026B3F3E0C22AD651F34600D0A");
  const parsed = parseG365Packet(frame, "861261021497967");
  assert.equal(parsed.protocol, 0x10);
  assert.equal(parsed.gpsValid, true);
  assert.ok(parsed.gps.lat > 0);
  assert.ok(parsed.gps.lng > 0);
  assert.equal(parsed.gps.speedKmh, 0x1f);

  const ack = buildG365AckForParsed(parsed, frame);
  assert.equal(toHex(ack), "787800100A03170F32170D0A");
});

test("g365 — heartbeat needs no ACK", () => {
  const frame = hex("787801080D0A");
  const parsed = parseG365Packet(frame, "999000000000001");
  assert.equal(parsed.protocol, 0x08);
  assert.equal(parsed.needsAck, false);
  assert.equal(buildG365AckForParsed(parsed, frame), null);
});

test("g365 — expiry date uses spec 4-byte format", () => {
  assert.equal(toHex(buildG365ExpiryDate("20301231")), "78780530203012310D0A");
  assert.equal(toHex(buildG365ExpiryDate("20221031")), "78780530202210310D0A");
});

test("g365 — 0x1B wifi/lbs with zero wifi and 3 LBS cells (real device)", () => {
  const frame = hex(
    "7878001B2605310801270301180A0000015507B89829720000015507B89829720000015507B8982972000D0A"
  );
  const { frames } = extractFramesFromStream(frame);
  assert.equal(frames.length, 1);

  const parsed = parseG365Packet(frames[0], "861261021497967");
  assert.equal(parsed.protocol, 0x1b);
  assert.equal(parsed.source, "lbs");
  assert.equal(parsed.imei, "861261021497967");
  assert.ok(parsed.lbsRaw);

  const ack = buildG365AckForParsed(parsed, frames[0]);
  assert.equal(toHex(ack), "7878001B2605310801270D0A");
});

test("g365 — 0x69 wifi/lbs variable length framing", () => {
  const frame = hex(
    "787803691604130318491475905BD30E25001E10BBF7635D14759006E62656" +
      "0501CC0028660F213228660F1F2828660EA81E286610731428660F20140D0A"
  );
  const { frames } = extractFramesFromStream(frame);
  assert.equal(frames.length, 1);

  const parsed = parseG365Packet(frames[0], "123456789012345");
  assert.equal(parsed.protocol, 0x69);
  assert.equal(parsed.wifiBssids.length, 3);
  assert.equal(parsed.wifiBssids[0], "14:75:90:5B:D3:0E");
  assert.equal(parsed.source, "wifi");

  const ack = buildG365TimestampAck(0x69, frame.subarray(4, 10));
  assert.equal(toHex(ack), "787800691604130318490D0A");
});

test("g365 — 0x13 status echo ACK", () => {
  const frame = hex("7878071355230803640D0A");
  const parsed = parseG365Packet(frame, "123456789012345");
  assert.equal(parsed.deviceStatus.battery, 0x55);
  assert.equal(parsed.deviceStatus.signal, 0x64);
  const ack = buildG365AckForParsed(parsed, frame);
  assert.equal(toHex(ack), toHex(frame));
});

test("g365 — basic 0x13 status with wrong length byte 0x07 (real device)", () => {
  const frame = hex("787807136409032C3E0D0A");
  const { frames, rest } = extractFramesFromStream(frame);
  assert.equal(frames.length, 1);
  assert.equal(rest.length, 0);
  assert.equal(frames[0].length, 11);

  const parsed = parseG365Packet(frames[0], "861991080050311");
  assert.equal(parsed.protocol, 0x13);
  assert.equal(parsed.deviceStatus.battery, 0x64);
  assert.equal(parsed.deviceStatus.signal, 0x3e);
});

test("g365 — GPS 0x10 with short length byte 0x14 (861991080050311 pet collar)", () => {
  const frame = hex("787814101A0603161C039A03C0E3C603A193CE001400002F0D0A");
  const { frames, rest } = extractFramesFromStream(frame);
  assert.equal(frames.length, 1);
  assert.equal(rest.length, 0);
  assert.equal(frames[0].length, 26);

  const parsed = parseG365Packet(frames[0], "861991080050311");
  assert.equal(parsed.protocol, 0x10);
  assert.equal(parsed.source, "gps");
  assert.equal(parsed.gpsValid, true);
  assert.ok(parsed.gps.lat > 34 && parsed.gps.lat < 36);
  assert.ok(parsed.gps.lng > 32 && parsed.gps.lng < 35);
  assert.equal(parsed.gps.satellites, 10);
});

test("g365 — stream splits mid-frame then completes", () => {
  const full = hex("787801080D0A787801080D0A");
  const part1 = full.subarray(0, 4);
  const part2 = full.subarray(4);
  const r1 = extractFramesFromStream(part1);
  assert.equal(r1.frames.length, 0);
  const r2 = extractFramesFromStream(Buffer.concat([r1.rest, part2]));
  assert.equal(r2.frames.length, 2);
});

test("g365 — extended 0x13 status (vendor PDF figure 1)", () => {
  const frame = hex(
    "78781613600308585A010000000000000000010017050A11021C0D0A"
  );
  const parsed = parseG365Packet(frame, "123456789012345");
  assert.equal(parsed.statusDetail.variant, "extended");
  assert.equal(parsed.statusDetail.battery, 0x60);
  assert.equal(parsed.statusDetail.signal, 0x5a);
  assert.equal(parsed.statusDetail.charging, true);
  assert.equal(parsed.statusDetail.steps, 0);
  assert.equal(parsed.deviceStatus.steps, 0);
});

test("g365 — time sync ACK uses 2-byte year + GMT bytes", () => {
  const ack = buildG365TimeAck(new Date(Date.UTC(2016, 6, 5, 5, 55, 24)));
  assert.equal(toHex(ack), "7878083007E007050537180D0A");
});

test("g365 — IMEI BCD decode", () => {
  const imeiBuf = hex("0123456789012345");
  assert.equal(decodeImeiBcd(imeiBuf), "123456789012345");
});
