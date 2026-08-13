/**
 * CRC-ITU used by Concox GT06 / GT02 style trackers.
 * Equivalent to CRC-16/X-25:
 *   poly=0x1021 (reflected 0x8408), init=0xFFFF, refin=true, refout=true, xorout=0xFFFF
 *
 * CRC covers bytes from Packet Length through Information Serial Number (inclusive).
 */

function crc16itu(buf) {
  let crc = 0xffff;
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
    }
  }
  return (~crc) & 0xffff;
}

function appendCrcItu(payloadWithoutCrc) {
  const crc = crc16itu(payloadWithoutCrc);
  const out = Buffer.alloc(payloadWithoutCrc.length + 2);
  payloadWithoutCrc.copy(out, 0);
  out.writeUInt16BE(crc, payloadWithoutCrc.length);
  return out;
}

module.exports = { crc16itu, appendCrcItu };
