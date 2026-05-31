function lbsCellSizeLocal(protocol) {
  return protocol === 0x18 || protocol === 0x19 || protocol === 0x1a || protocol === 0x1b ? 9 : 5;
}

/**
 * Decode 365GPS 3-byte MCC/MNC (4G WiFi/LBS packets). * Example Cyprus Epic: 01 18 0A → MCC 280, MNC 10.
 */
function decodeG365MccMnc(buf3) {
  if (!Buffer.isBuffer(buf3) || buf3.length < 3) return null;
  const mcc = buf3.readUInt16BE(0);
  const mnc = buf3.readUInt8(2);
  if (!Number.isFinite(mcc) || mcc < 1 || mcc > 999) return null;
  return { mcc, mnc };
}

/**
 * @param {Buffer} buf LBS block: [count][mcc/mnc:3][cells…]
 * @param {number} protocol 0x17–0x1b, 0x69, etc.
 */
function parseG365LbsCells(buf, protocol) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  const count = buf.readUInt8(0);
  if (count === 0 || count > 8) return null;
  const mccMnc = decodeG365MccMnc(buf.subarray(1, 4));
  if (!mccMnc) return null;

  const cellSize = lbsCellSizeLocal(protocol);
  const cells = [];
  let o = 4;
  for (let i = 0; i < count; i++) {
    if (o + cellSize > buf.length) break;
    const lac = buf.readUInt32BE(o);
    const cellId = buf.readUInt32BE(o + 4);
    const rssiAbs = buf.readUInt8(o + cellSize - 1);
    const signalStrength = rssiAbs > 0 ? -rssiAbs : undefined;
    if (lac > 0 && cellId > 0) {
      cells.push({ lac, cellId, signalStrength });
    }
    o += cellSize;
  }
  if (cells.length === 0) return null;
  return { ...mccMnc, cells };
}

/** @param {string|null} lbsRawHex */
function parseG365LbsCellsFromHex(lbsRawHex, protocol) {
  const hex = String(lbsRawHex || "").replace(/\s+/g, "");
  if (!hex || hex.length < 8) return null;
  try {
    return parseG365LbsCells(Buffer.from(hex, "hex"), protocol);
  } catch {
    return null;
  }
}

module.exports = {
  decodeG365MccMnc,
  parseG365LbsCells,
  parseG365LbsCellsFromHex,
};
