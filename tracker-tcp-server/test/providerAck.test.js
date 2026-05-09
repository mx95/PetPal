/**
 * Provider golden ACK scenarios (Correct reply) + regression offsets.
 * Run: npm test   or   node --test test/providerAck.test.js
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAck } = require("../src/protocol/xexun");
const {
  ackOffsetSecondsFor020Ack,
  extractGpsTrackingDurationByte,
  payloadHasGps064Block
} = require("../src/protocol/portalAckOffset");

const IMEI8_DEMO = Buffer.from("0869469088344608", "hex");

function tlv(type, bodyBuf) {
  return Buffer.concat([Buffer.from([type & 0xff, bodyBuf.length & 0xff]), bodyBuf]);
}

/** First 0x64 GPS block per vendor layout (len 0x22); last byte = seconds-to-tracking */
function build064Payload({
  successfulTrackingTimeHex,
  gpsTailByte,
  battery,
  networkDuration,
  signal,
  trackingSeq
}) {
  const ts = Buffer.from(String(successfulTrackingTimeHex).replace(/\s/g, ""), "hex");
  assert.equal(ts.length, 4);
  const body = Buffer.alloc(0x22);
  ts.copy(body, 0);
  body[body.length - 1] = gpsTailByte & 0xff;

  const gps = tlv(0x64, body);

  const sixA = Buffer.alloc(0x18);
  sixA.writeUInt8(battery & 0xff, 0);
  sixA.writeUInt16BE(networkDuration & 0xffff, 1);
  sixA.writeUInt8(signal & 0xff, 3);
  sixA.writeUInt8(trackingSeq & 0xff, 4);
  sixA.fill(0xff, 5, 13);
  Buffer.from(successfulTrackingTimeHex.replace(/\s/g, ""), "hex").copy(sixA, 13);

  return Buffer.concat([gps, tlv(0x6a, sixA)]);
}

/** Status-only (no 0x64): epoch embedded in 0x6A for parseDeviceStatusBlock */
function buildStatusOnlyPayload({ battery, networkDuration, signal, trackingSeq, epochHex }) {
  const epoch = Buffer.from(String(epochHex).replace(/\s/g, ""), "hex");
  assert.equal(epoch.length, 4);
  const sixA = Buffer.alloc(0x18);
  sixA.writeUInt8(battery & 0xff, 0);
  sixA.writeUInt16BE(networkDuration & 0xffff, 1);
  sixA.writeUInt8(signal & 0xff, 3);
  sixA.writeUInt8(trackingSeq & 0xff, 4);
  sixA.fill(0xff, 5, 13);
  epoch.copy(sixA, 13);
  return tlv(0x6a, sixA);
}

function extractStatusLikeHandler(rawPayload) {
  for (let i = 0; i + 2 <= rawPayload.length; i++) {
    if (rawPayload.readUInt8(i) !== 0x6a) continue;
    const len = rawPayload.readUInt8(i + 1);
    const start = i + 2;
    const end = start + len;
    if (end > rawPayload.length || len < 5) continue;
    const block = rawPayload.subarray(start, end);
    return {
      battery: block.readUInt8(0),
      networkDuration: block.readUInt16BE(1),
      signal: block.readUInt8(3),
      trackingSeq: block.readUInt8(4)
    };
  }
  return null;
}

function withSilentAck(fn) {
  const orig = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = orig;
  }
}

function normHex(h) {
  return String(h)
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

test("portalAckOffset — regression matrix (synthetic payloads)", () => {
  const cases = [
    { name: "tracking 18 / signal 15 → +3", status: { trackingSeq: 18, signal: 15 }, gps: 0, want: 3 },
    { name: "tracking 19 / signal 15 → +4", status: { trackingSeq: 19, signal: 15 }, gps: 0, want: 4 },
    { name: "tracking 20 / signal 16 → +4", status: { trackingSeq: 20, signal: 16 }, gps: 0, want: 4 },
    { name: "tracking 21 / signal 15 → +6", status: { trackingSeq: 21, signal: 15 }, gps: 0, want: 6 },
    { name: "tracking 29 / signal 29 → +0", status: { trackingSeq: 29, signal: 29 }, gps: 6, want: 0 },
    { name: "tracking 31 / signal 29 → +2", status: { trackingSeq: 31, signal: 29 }, gps: 0, want: 2 },
    {
      name: "tracking 20 / signal 21 → +4 (tracking < signal)",
      status: { trackingSeq: 20, signal: 21 },
      gps: 0,
      want: 4
    },
    {
      name: "tracking 30 / signal 24 → +7 (bump)",
      status: { trackingSeq: 30, signal: 24 },
      gps: 0x16,
      want: 7
    },
    {
      name: "tracking 21 / signal 15 tail≠0 → +6",
      status: { trackingSeq: 21, signal: 15 },
      gps: 0x10,
      want: 6
    },
    {
      name: "provider S1/S2 style: signal 23, tracking≥30, tail 0 → +2",
      status: { trackingSeq: 35, signal: 23 },
      gps: 0,
      want: 2
    },
    {
      name: "live: signal 29 (0x1D), tail 0 → +2 not tracking−signal",
      status: { trackingSeq: 32, signal: 29 },
      gps: 0,
      want: 2
    },
    {
      name: "live: signal 29, tracking 34 → +2 not +5",
      status: { trackingSeq: 34, signal: 29 },
      gps: 0,
      want: 2
    },
    {
      name: "provider S4: Δ5 + GPS tail 6 → +0",
      status: { trackingSeq: 29, signal: 24 },
      gps: 6,
      want: 0
    }
  ];

  const hdr = Buffer.from([0x64, 0x22]);
  const body = Buffer.alloc(0x22);
  for (const c of cases) {
    body.fill(0);
    body[body.length - 1] = c.gps & 0xff;
    const raw = Buffer.concat([hdr, body]);
    assert.equal(
      ackOffsetSecondsFor020Ack(c.status, raw),
      c.want,
      c.name
    );
  }
});

test("providerAckOffset — status-only (no 0x64) → +3", () => {
  const raw = buildStatusOnlyPayload({
    battery: 0x3b,
    networkDuration: 2,
    signal: 26,
    trackingSeq: 0,
    epochHex: "69FF51BA"
  });
  assert.equal(payloadHasGps064Block(raw), false);
  assert.equal(ackOffsetSecondsFor020Ack(extractStatusLikeHandler(raw), raw), 3);
});

test("golden buildAck — provider Correct reply samples", () => {
  const scenarios = [
    {
      name: "S1 GPS uplink seq 0x27 → Correct reply EB / CRC 4B66",
      seq: 0x27,
      rawPayload: build064Payload({
        successfulTrackingTimeHex: "69FF53E9",
        gpsTailByte: 0x00,
        battery: 0x39,
        networkDuration: 0,
        signal: 0x17,
        trackingSeq: 0x23
      }),
      expectedAckHex:
        "FC001003202708694690883446080069FF53EB4B66CF"
    },
    {
      name: "S2 GPS uplink seq 0x28 → Correct reply FB / CRC C23A",
      seq: 0x28,
      rawPayload: build064Payload({
        successfulTrackingTimeHex: "69FF53F9",
        gpsTailByte: 0x00,
        battery: 0x39,
        networkDuration: 0,
        signal: 0x17,
        trackingSeq: 0x24
      }),
      expectedAckHex:
        "FC001003202808694690883446080069FF53FBC23ACF"
    },
    {
      name: "S3 status-only seq 0x18 → Correct reply BD / CRC D762",
      seq: 0x18,
      rawPayload: buildStatusOnlyPayload({
        battery: 0x3b,
        networkDuration: 2,
        signal: 0x1a,
        trackingSeq: 0,
        epochHex: "69FF51BA"
      }),
      expectedAckHex:
        "FC001003201808694690883446080069FF51BDD762CF"
    },
    {
      name: "S4 GPS Δ5 + tail 6 seq 0x20 → Correct reply same epoch / CRC 26C2",
      seq: 0x20,
      rawPayload: build064Payload({
        successfulTrackingTimeHex: "69FF5217",
        gpsTailByte: 0x06,
        battery: 0x3a,
        networkDuration: 0,
        signal: 0x18,
        trackingSeq: 0x1d
      }),
      expectedAckHex:
        "FC001003202008694690883446080069FF521726C2CF"
    },
    {
      name: "S5 GPS bump seq 0x22 → Correct reply A1 / CRC 242C",
      seq: 0x22,
      rawPayload: build064Payload({
        successfulTrackingTimeHex: "69FF539A",
        gpsTailByte: 0x16,
        battery: 0x3a,
        networkDuration: 0,
        signal: 0x18,
        trackingSeq: 0x1e
      }),
      expectedAckHex:
        "FC001003202208694690883446080069FF53A1242CCF"
    }
  ];

  for (const s of scenarios) {
    const statusRaw = extractStatusLikeHandler(s.rawPayload);
    assert.ok(statusRaw, `${s.name}: status TLV`);
    const ts = (() => {
      for (let i = 0; i + 6 <= s.rawPayload.length; i++) {
        if (s.rawPayload.readUInt8(i) !== 0x64) continue;
        const l = s.rawPayload.readUInt8(i + 1);
        if (l < 4) continue;
        const end = i + 2 + l;
        if (end > s.rawPayload.length) continue;
        return s.rawPayload.subarray(i + 2, i + 6);
      }
      const { parseDeviceStatusBlock } = require("../src/protocol/xexun");
      const block = (() => {
        for (let i = 0; i + 2 <= s.rawPayload.length; i++) {
          if (s.rawPayload.readUInt8(i) !== 0x6a) continue;
          const len = s.rawPayload.readUInt8(i + 1);
          const end = i + 2 + len;
          if (end > s.rawPayload.length) continue;
          return s.rawPayload.subarray(i + 2, end);
        }
        return null;
      })();
      assert.ok(block);
      const ds = parseDeviceStatusBlock(block);
      assert.ok(ds.timestampBytes && ds.timestampBytes.length === 4);
      return ds.timestampBytes;
    })();

    const offsetSeconds = ackOffsetSecondsFor020Ack(statusRaw, s.rawPayload);
    const gpsTail = extractGpsTrackingDurationByte(s.rawPayload);

    const ack = withSilentAck(() =>
      buildAck({
        sequence: s.seq,
        imei: IMEI8_DEMO,
        timestampBytes: ts,
        offsetSeconds
      })
    );

    assert.equal(normHex(ack.toString("hex")), normHex(s.expectedAckHex), `${s.name} offset=${offsetSeconds} tail=${gpsTail}`);
  }
});

test("wrong platform examples differ from Correct reply (sanity)", () => {
  const bad = withSilentAck(() =>
    buildAck({
      sequence: 0x27,
      imei: IMEI8_DEMO,
      timestampBytes: Buffer.from("69FF53E9", "hex"),
      offsetSeconds: 12
    })
  );
  assert.equal(
    normHex(bad.toString("hex")),
    "FC001003202708694690883446080069FF53F5B899CF",
    "legacy +12 offset matches previously wrong platform line"
  );
});
