/**
 * Portal "Correct reply" timestamp offset for 0x20 ACK fixed-reply mark (empirical; not in vendor PDF).
 *
 * Reads:
 * - 0x6A status: communication signal @ byte index 3, tracking sequence @ byte index 4 (after battery + network duration).
 * - First 0x64 GPS body: last byte = "seconds to tracking" (portal labels).
 *
 * Rules derived from your portal samples:
 * - Usually: offset = trackingSeq - signal (when trackingSeq >= signal).
 * - When trackingSeq < signal: offset = 4 * (signal - trackingSeq) (e.g. 20 / 21 → +4).
 * - When base delta is 6 and GPS tail > 0 and trackingSeq >= 30: use +7 instead of +6 (e.g. 30 / 24 / active GPS interval).
 */

function extractGpsTrackingDurationByte(rawPayload) {
  if (!Buffer.isBuffer(rawPayload)) return null;
  for (let i = 0; i + 2 <= rawPayload.length; i++) {
    if (rawPayload.readUInt8(i) !== 0x64) continue;
    const l = rawPayload.readUInt8(i + 1);
    const start = i + 2;
    const end = start + l;
    if (end > rawPayload.length || l < 1) continue;
    return rawPayload.readUInt8(end - 1);
  }
  return null;
}

function ackOffsetSecondsFor020Ack(statusRaw, rawPayload) {
  const gpsTrackTail = extractGpsTrackingDurationByte(rawPayload);

  if (
    statusRaw &&
    typeof statusRaw.trackingSeq === "number" &&
    Number.isFinite(statusRaw.trackingSeq) &&
    typeof statusRaw.signal === "number" &&
    Number.isFinite(statusRaw.signal)
  ) {
    const t = statusRaw.trackingSeq;
    const s = statusRaw.signal;

    let d;
    if (t < s) {
      d = 4 * (s - t);
    } else {
      d = t - s;
    }

    // seq30-style portal sample: base 6 → needs 7 when GPS reports non-zero tracking interval; do not bump seq21 (+6).
    if (d === 6 && typeof gpsTrackTail === "number" && gpsTrackTail > 0 && t >= 30) {
      return 7;
    }

    return Math.max(0, d);
  }

  const raw = process.env.ACK_TS_OFFSET_SECONDS;
  const n = raw != null && String(raw).trim() !== "" ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 3;
}

module.exports = {
  extractGpsTrackingDurationByte,
  ackOffsetSecondsFor020Ack
};
