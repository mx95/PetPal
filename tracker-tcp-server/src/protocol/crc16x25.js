// CRC-16/CCITT-FALSE:
// width=16 poly=0x1021 init=0xFFFF refin=false refout=false xorout=0x0000
function crc16ccittFalse(buf) {
  let crc = 0xffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= (buf[i] << 8) & 0xffff;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function u16be(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n & 0xffff, 0);
  return b;
}

function u16le(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}

module.exports = { crc16ccittFalse, u16be, u16le };

