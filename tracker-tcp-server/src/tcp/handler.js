const net = require("net");
const {
  parseXexunPacket,
  buildAck,
  buildAckFrame,
  buildServerCommand021,
  toHex,
  isValidCrc
} = require("../protocol/xexun");

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

function sendNextQueuedCommand(socket, imei, store) {
  const cmd = store.dequeueCommand(imei);
  if (!cmd) return;
  try {
    const seq = store.nextSequence(imei);
    const frame = buildServerCommand021({ imei, commandAscii: cmd, sequence: seq });
    socket.write(frame);
    console.log(`[TCP] 0x21 → ${imei}: ${cmd}`);
    console.log("[TCP] CMD HEX:", toHex(frame));
    if (typeof store.markCommandSent === "function") {
      store.markCommandSent({ imei, command: cmd });
    }
  } catch (e) {
    console.log("[TCP] 0x21 send failed:", e?.message || String(e));
    store.enqueueCommand(imei, cmd, { atFront: true });
  }
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
          source: parsed.source ?? null,
          gpsValid: parsed.gpsValid ?? null,
          battery: deviceStatus.battery ?? null,
          signal: parsed.signal ?? null,
          timestamp: deviceStatus.timestamp ?? (parsed.gps?.timestamp ?? null),
          secondsAgo:
            (() => {
              const ts = deviceStatus.timestamp ?? parsed.gps?.timestamp ?? null;
              if (!ts) return null;
              const ms = Date.parse(ts);
              if (!Number.isFinite(ms)) return null;
              return Math.max(0, Math.round((Date.now() - ms) / 1000));
            })(),
          steps: deviceStatus.steps ?? null,
          lat: parsed.gps?.lat ?? null,
          lng: parsed.gps?.lng ?? null,
          raw: parsed.rawHex
        };
        console.log("[TCP] PARSED:", JSON.stringify(logObj));

        if (
          parsed.messageId !== 0x20 &&
          parsed.messageId !== 0x21 &&
          parsed.messageId !== 0x6a
        ) {
          console.log(
            `[TCP] Warning: unknown messageId=0x${parsed.messageId.toString(16)} (ACKing anyway)`
          );
        }

        store.upsert(parsed.imei, parsed);
        store.bindSocket(parsed.imei, socket);
        if (parsed.messageId === 0x21 && typeof store.markLatestCommandAcked === "function") {
          store.markLatestCommandAcked({ imei: parsed.imei });
        }

        // ACK (CRITICAL)
        try {
          const imei8 = frame.subarray(6, 14);
          let fixedReply = null;
          if (parsed.messageId === 0x21) {
            const p = parsed._payload;
            let body = null;
            if (Buffer.isBuffer(p) && p.length >= 2 && p.readUInt8(0) === 0x74) {
              const l = p.readUInt8(1);
              const end = 2 + l;
              if (end <= p.length) body = p.subarray(2, end);
            }
            if (!body && Buffer.isBuffer(p) && p.length > 0) body = p;

            if (Buffer.isBuffer(body) && body.length > 0) {
              const trimmed =
                body[body.length - 1] === 0x00
                  ? body.subarray(0, body.length - 1)
                  : body;
              fixedReply = Buffer.concat([trimmed, Buffer.from(",10", "ascii")]);
            }
          }
          if (parsed.messageId === 0x20) {
            const rawPayload = frame.subarray(14, frame.length - 3); // payload only (no CRC+CF)

            // Provider-confirmed: use "Successful Tracking Time" from the FIRST GPS block (0x64):
            // [0x64][len][timestamp:4]...
            let timestampBytes = null;
            for (let i = 0; i + 6 <= rawPayload.length; i++) {
              if (rawPayload.readUInt8(i) !== 0x64) continue;
              const l = rawPayload.readUInt8(i + 1);
              if (l < 4) continue;
              const end = i + 2 + l;
              if (end > rawPayload.length) continue;
              timestampBytes = rawPayload.subarray(i + 2, i + 6);
              break;
            }

            if (!timestampBytes || timestampBytes.length !== 4) {
              throw new Error("Missing 0x64 Successful Tracking Time (timestampBytes) for 0x20 ACK");
            }

            console.log("[ACK TS SOURCE 0x64]:", timestampBytes.toString("hex").toUpperCase());

            const ack = buildAck({ sequence: parsed.sequence, imei: imei8, timestampBytes });
            socket.write(ack);
          } else {
            const ack = buildAckFrame({
              version: parsed.version,
              messageId: parsed.messageId,
              sequence: parsed.sequence,
              imei8,
              fixedReply
            });
            socket.write(ack);
            console.log("[TCP] ACK HEX:", toHex(ack));
          }

          // After successful uplink (0x20), push one queued server command (0x21), per Xexun API.
          if (parsed.messageId === 0x20) {
            if (parsed.gpsValid === false && parsed.source === "lbs") {
              console.log("[TCP] GPS invalid → using LBS fallback");
            }
            sendNextQueuedCommand(socket, parsed.imei, store);
          }
        } catch (e) {
          console.log("[TCP] Failed to send ACK:", e?.message || String(e));
        }
      }
    });

    socket.on("close", () => {
      store.releaseSocket(socket);
      console.log("[TCP] connection closed");
    });
    socket.on("error", (err) => console.log("[TCP] socket error:", err.message));
  });

  server.listen(port, () => console.log(`TCP server listening on port ${port}`));
  return server;
}

module.exports = { createTcpServer, extractFramesFromStream };

