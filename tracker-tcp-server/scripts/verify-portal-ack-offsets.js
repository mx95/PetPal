/**
 * Regression checks for portal ACK timestamp offset logic vs scenarios discussed in PetPal integration.
 * Run: node scripts/verify-portal-ack-offsets.js
 */

const assert = require("assert");
const { ackOffsetSecondsFor020Ack } = require("../src/protocol/portalAckOffset");

/** Minimal synthetic payload: first 0x64 with length 0x22; last byte of GPS body = gpsTailByte */
function payloadWithGpsTail(gpsTailByte) {
  const hdr = Buffer.from([0x64, 0x22]);
  const body = Buffer.alloc(0x22);
  body.fill(0);
  if (gpsTailByte != null) body[body.length - 1] = gpsTailByte & 0xff;
  return Buffer.concat([hdr, body]);
}

const cases = [
  { name: "tracking 18 / signal 15 → +3", status: { trackingSeq: 18, signal: 15 }, gps: 0, want: 3 },
  { name: "tracking 19 / signal 15 → +4", status: { trackingSeq: 19, signal: 15 }, gps: 0, want: 4 },
  { name: "tracking 20 / signal 16 → +4", status: { trackingSeq: 20, signal: 16 }, gps: 0, want: 4 },
  { name: "tracking 21 / signal 15 → +6", status: { trackingSeq: 21, signal: 15 }, gps: 0, want: 6 },
  { name: "tracking 29 / signal 29 → +0", status: { trackingSeq: 29, signal: 29 }, gps: 6, want: 0 },
  { name: "tracking 31 / signal 29 → +2 (GPS tail 0)", status: { trackingSeq: 31, signal: 29 }, gps: 0, want: 2 },
  { name: "tracking 20 / signal 21 → +4 (tracking < signal)", status: { trackingSeq: 20, signal: 21 }, gps: 0, want: 4 },
  {
    name: "tracking 30 / signal 24 → +7 (base 6 + bump when GPS interval tail > 0 and tracking≥30)",
    status: { trackingSeq: 30, signal: 24 },
    gps: 0x16,
    want: 7
  },
  {
    name: "tracking 21 / signal 15 stays +6 even if GPS tail > 0 (no bump below 30)",
    status: { trackingSeq: 21, signal: 15 },
    gps: 0x10,
    want: 6
  },
  {
    name: "tracking 35 / signal 23 (vendor signal 23 & tracking≥30 & tail 0) → +2",
    status: { trackingSeq: 35, signal: 23 },
    gps: 0,
    want: 2
  }
];

for (const c of cases) {
  const raw = payloadWithGpsTail(c.gps);
  const got = ackOffsetSecondsFor020Ack(c.status, raw);
  assert.strictEqual(
    got,
    c.want,
    `${c.name}: expected +${c.want}s, got +${got}s`
  );
}

console.log(`OK: ${cases.length} portal ACK offset scenarios passed.`);
