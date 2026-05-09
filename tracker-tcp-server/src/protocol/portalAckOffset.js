/**
 * Portal / vendor "Correct reply" timestamp offset for 0x20 ACK fixed-reply mark (empirical).
 *
 * Reads:
 * - First GPS TLV 0x64 body: last byte = "seconds to tracking" when present.
 * - 0x6A status: communication signal @ index 3, tracking sequence @ index 4 (after battery + network duration).
 *
 * Rules combine earlier PetPal portal tuning with **provider-published golden ACKs**:
 * - No GPS 0x64 in payload → use ACK_TS_OFFSET_SECONDS or default **+3** (status/battery-only uplinks).
 * - Provider golden: tracking−signal = 5 and GPS tail byte = **6** → **+0** (fixed reply matches GPS time).
 * - Same pattern with comm signal **23** or **29** (0x1D), tracking ≥ **30**, idle GPS interval (tail **0**) → **+2** (not +Δ).
 * - When tracking < signal: **4 × (signal − tracking)**.
 * - Else base Δ = tracking − signal; if Δ = 6, GPS tail > 0, tracking ≥ 30 → **+7** (interval bump).
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

function payloadHasGps064Block(rawPayload) {
  if (!Buffer.isBuffer(rawPayload)) return false;
  for (let i = 0; i + 2 <= rawPayload.length; i++) {
    if (rawPayload.readUInt8(i) !== 0x64) continue;
    const l = rawPayload.readUInt8(i + 1);
    const end = i + 2 + l;
    if (l >= 4 && end <= rawPayload.length) return true;
  }
  return false;
}

function ackOffsetSecondsFor020Ack(statusRaw, rawPayload) {
  const gpsTrackTail = extractGpsTrackingDurationByte(rawPayload);
  const has064 = payloadHasGps064Block(rawPayload);

  if (!has064) {
    const raw = process.env.ACK_TS_OFFSET_SECONDS;
    const n = raw != null && String(raw).trim() !== "" ? Number(raw) : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 3;
  }

  if (
    statusRaw &&
    typeof statusRaw.trackingSeq === "number" &&
    Number.isFinite(statusRaw.trackingSeq) &&
    typeof statusRaw.signal === "number" &&
    Number.isFinite(statusRaw.signal)
  ) {
    const t = statusRaw.trackingSeq;
    const s = statusRaw.signal;

    // Provider golden: GPS tracking time echoed unchanged (Successful Tracking Time = fixed reply).
    if (t >= s && t - s === 5 && gpsTrackTail === 6) {
      return 0;
    }

    // Vendor uplinks: comm signal 23 or 29 (0x1D), tracking ≥ 30, zero GPS-interval tail → +2 s (not +Δ).
    if (gpsTrackTail === 0 && t >= 30 && (s === 23 || s === 29)) {
      return 2;
    }

    let d;
    if (t < s) {
      d = 4 * (s - t);
    } else {
      d = t - s;
    }

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
  payloadHasGps064Block,
  ackOffsetSecondsFor020Ack
};
