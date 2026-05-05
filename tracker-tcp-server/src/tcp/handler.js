const net = require("net");
const { parseXexunPacket, buildAck, toHex, isValidCrc } = require("../protocol/xexun");

function extractFramesFromStream(buffer) {
  // Stream-safe framing for FC...CF.
  // Uses the length field: total frame size is `length + 6`.
  const frames = [];
  let buf = buffer;

  while (buf.length > 0) {
    const start = buf.indexOf(0xfc);
    if (start === -1) return { frames, rest: Buffer.alloc(0) };
    if (start > 0) buf = buf.subarray(start);

    if (buf.length < 4) return { frames, rest: buf }; // need at least FC + len(2) + ver

    const len = buf.readUInt16BE(1);
    const total = len + 6;
    if (buf.length < total) return { frames, rest: buf };
    if (buf.readUInt8(total - 1) !== 0xcf) {
      // Fallback: resync by searching end flag
      const end = buf.indexOf(0xcf, 1);
      if (end === -1) return { frames, rest: buf };
      const frame = buf.subarray(0, end + 1);
      frames.push(frame);
      buf = buf.subarray(end + 1);
      continue;
    }

    const frame = buf.subarray(0, total);
    frames.push(frame);
    buf = buf.subarray(total);

  }

  return { frames, rest: Buffer.alloc(0) };
}

function createTcpServer({ port, store }) {
  const server = net.createServer((socket) => {
    socket.setKeepAlive(true);
    socket.setNoDelay(true);

    console.log(`[TCP] connection from ${socket.remoteAddress}:${socket.remotePort}`);

    let pending = Buffer.alloc(0);

    socket.on("data", (data) => {
      console.log("[TCP] RAW HEX:", toHex(data));

      pending = Buffer.concat([pending, data]);
      const { frames, rest } = extractFramesFromStream(pending);
      pending = rest;

      for (const frame of frames) {
        const crcCheck = isValidCrc(frame);
        if (!crcCheck.ok) {
          console.log("[TCP] CRC invalid, ignoring frame:", toHex(frame));
          continue;
        }

        const parsed = parseXexunPacket(frame);
        if (!parsed) {
          console.log("[TCP] Unparsed frame:", toHex(frame));
          continue;
        }

        // Structured log requested
        const deviceStatus = parsed.deviceStatus || {};
        const logObj = {
          imei: parsed.imei,
          messageId: parsed.messageId,
          battery: deviceStatus.battery ?? null,
          signal: parsed.signal ?? null,
          timestamp: deviceStatus.timestamp ?? (parsed.gps?.timestamp ?? null),
          steps: deviceStatus.steps ?? null,
          lat: parsed.gps?.lat ?? null,
          lng: parsed.gps?.lng ?? null,
          raw: parsed.rawHex
        };
        console.log("[TCP] PARSED:", JSON.stringify(logObj));

        if (parsed.messageId !== 0x20 && parsed.messageId !== 0x6a) {
          console.log(
            `[TCP] Warning: unknown messageId=0x${parsed.messageId.toString(16)} (ACKing anyway)`
          );
        }

        store.upsert(parsed.imei, parsed);

        // ACK (CRITICAL)
        try {
          const imei8 = frame.subarray(6, 14);
          let fixedReply = null;
          if (parsed.messageId === 0x20) {
            const tsBytes = parsed.deviceStatus?.timestampBytes;
            if (tsBytes && tsBytes.length === 4) {
              fixedReply = Buffer.concat([Buffer.from([0x00]), Buffer.from(tsBytes)]);
            }
          } else if (parsed.messageId === 0x21) {
            const p = parsed._payload;
            if (Buffer.isBuffer(p) && p.length > 0) {
              const trimmed = p[p.length - 1] === 0x00 ? p.subarray(0, p.length - 1) : p;
              fixedReply = Buffer.concat([trimmed, Buffer.from(",10", "ascii")]);
            }
          }
          const ack = buildAck({
            version: parsed.version,
            messageId: parsed.messageId,
            sequence: parsed.sequence,
            imei8,
            fixedReply
          });
          socket.write(ack);
          console.log("[TCP] ACK HEX:", toHex(ack));
        } catch (e) {
          console.log("[TCP] Failed to send ACK:", e?.message || String(e));
        }
      }
    });

    socket.on("close", () => console.log("[TCP] connection closed"));
    socket.on("error", (err) => console.log("[TCP] socket error:", err.message));
  });

  server.listen(port, () => console.log(`TCP server listening on port ${port}`));
  return server;
}

module.exports = { createTcpServer, extractFramesFromStream };

