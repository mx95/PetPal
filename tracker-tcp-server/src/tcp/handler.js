const net = require("net");
const {
  parseXexunPacket,
  buildAck,
  buildAckFrame,
  buildServerCommand021,
  toHex,
  isValidCrc,
  parseDeviceStatusBlock
} = require("../protocol/xexun");
const { logPrefix, formatCyprusTime } = require("../logging/time");
const { DEVICE, logDeviceConnect, logDeviceIdentified, logListenerReady } = require("../logging/deviceLog");
const {
  extractGpsTrackingDurationByte,
  ackOffsetSecondsFor020Ack
} = require("../protocol/portalAckOffset");

function extractFirst6aRawBlock(rawPayload) {
  if (!Buffer.isBuffer(rawPayload) || rawPayload.length < 2) return null;
  for (let i = 0; i + 2 <= rawPayload.length; i++) {
    if (rawPayload.readUInt8(i) !== 0x6a) continue;
    const len = rawPayload.readUInt8(i + 1);
    const end = i + 2 + len;
    if (end > rawPayload.length) continue;
    return rawPayload.subarray(i + 2, end);
  }
  return null;
}

function asciiPreview(buf, max = 160) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return null;
  return buf
    .subarray(0, max)
    .toString("utf8")
    .replace(/[^\x20-\x7E]/g, ".");
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function recordTcpInbound(store, socket, event, patch = {}) {
  const entry = {
    ts: new Date().toISOString(),
    remoteAddress: socket.remoteAddress || null,
    remotePort: socket.remotePort || null,
    event,
    ...patch
  };
  console.log(`${logPrefix({ dir: "in", tag: "Xexun" })} AUDIT ${JSON.stringify({ ...entry, provider: "xexun" })}`);
  if (typeof store.recordTcpInboundRequest === "function") {
    store.recordTcpInboundRequest(entry);
  }
}

function extractStatusFrom020Payload(rawPayload) {
  // rawPayload is the message body payload (after IMEI, before CRC), i.e. TLV chain.
  // Find first 0x6A status block: [0x6A][len][battery][networkDuration:2][signal][trackingSeq]...
  if (!Buffer.isBuffer(rawPayload) || rawPayload.length < 2) return null;
  for (let i = 0; i + 2 <= rawPayload.length; i++) {
    if (rawPayload.readUInt8(i) !== 0x6a) continue;
    const len = rawPayload.readUInt8(i + 1);
    const start = i + 2;
    const end = start + len;
    if (end > rawPayload.length) continue;
    const block = rawPayload.subarray(start, end);
    if (block.length < 5) continue;
    return {
      offset: i,
      len,
      battery: block.readUInt8(0),
      networkDuration: block.length >= 3 ? block.readUInt16BE(1) : null,
      signal: block.readUInt8(3),
      trackingSeq: block.readUInt8(4),
      rawHex: toHex(block),
    };
  }
  return null;
}

function extractFramesFromStream(buffer) {
  // Stream-safe framing for FC…CF.
  // Uses the length field: total frame size is `length + 6`.
  //
  // IMPORTANT: Do not truncate at the first 0xCF inside the payload — binary GPS/LBS data can
  // contain 0xCF; that produced short “ghost” frames where byte 5 looked like a plausible seq
  // (e.g. 0x26) while the real uplink still had 0x27 at the true header offset.
  const frames = [];
  let buf = buffer;

  while (buf.length > 0) {
    const start = buf.indexOf(0xfc);
    if (start === -1) return { frames, rest: buf };
    if (start > 0) buf = buf.subarray(start);

    if (buf.length < 4) return { frames, rest: buf };

    const len = buf.readUInt16BE(1);
    const total = len + 6;

    if (len < 0x08 || len > 0x1000) {
      buf = buf.subarray(1);
      continue;
    }

    if (buf.length < total) return { frames, rest: buf };

    if (buf.readUInt8(total - 1) !== 0xcf) {
      buf = buf.subarray(1);
      continue;
    }

    const candidate = buf.subarray(0, total);
    if (!isValidCrc(candidate).ok) {
      buf = buf.subarray(1);
      continue;
    }

    frames.push(Buffer.from(candidate));
    buf = buf.subarray(total);
  }

  return { frames, rest: Buffer.alloc(0) };
}

function sendNextQueuedCommand(socket, imei, store) {
  const enabledRaw = process.env.SEND_021_AFTER_020;
  const enabled =
    enabledRaw == null || String(enabledRaw).trim() === ""
      ? true
      : String(enabledRaw).trim() !== "0" && String(enabledRaw).trim().toLowerCase() !== "false";
  if (!enabled) return;

  const cmd = store.dequeueCommand(imei);
  if (!cmd) return;
  try {
    const seq = store.nextSequence(imei);
    const frame = buildServerCommand021({ imei, commandAscii: cmd, sequence: seq });
    socket.write(frame);
    console.log(`${logPrefix({ dir: "out", tag: "Xexun" })} 0x21 → ${imei}: ${cmd}`);
    console.log(`${logPrefix({ dir: "out", tag: "Xexun" })} CMD HEX: ${toHex(frame)}`);
    if (typeof store.markCommandSent === "function") {
      store.markCommandSent({ imei, command: cmd });
    }
  } catch (e) {
    console.log(`${logPrefix({ dir: "out", tag: "Xexun" })} 0x21 send failed:`, e?.message || String(e));
    store.enqueueCommand(imei, cmd, { atFront: true });
  }
}

function createTcpServer({ port, store }) {
  const server = net.createServer((socket) => {
    socket.setKeepAlive(true);
    socket.setNoDelay(true);

    logDeviceConnect(DEVICE.XEXUN, socket, port);
    recordTcpInbound(store, socket, "connection", { note: "Xexun socket connected", provider: "xexun" });

    let pending = Buffer.alloc(0);

    socket.on("data", (data) => {
      console.log(`${logPrefix({ dir: "in", tag: "Xexun" })} RAW HEX: ${toHex(data)}`);
      recordTcpInbound(store, socket, "data", {
        byteLength: data.length,
        rawHex: toHex(data),
        asciiPreview: asciiPreview(data)
      });

      pending = Buffer.concat([pending, data]);
      const { frames, rest } = extractFramesFromStream(pending);
      pending = rest;

      if (frames.length === 0 && pending.length > 0 && pending.indexOf(0xfc) === -1) {
        // Provider misconfig often sends to the wrong port (e.g. HTTP port 5002) or wraps the payload.
        // This makes it obvious in logs.
        console.log(
          `${logPrefix({ dir: "in", tag: "Xexun" })} Warning: received ${pending.length} bytes with no FC header yet (not an Xexun frame). Check provider port is TCP 5001 and it forwards raw FC…CF.`
        );
        recordTcpInbound(store, socket, "non_xexun_pending", {
          byteLength: pending.length,
          rawHex: toHex(pending),
          asciiPreview: asciiPreview(pending),
          note: "pending bytes contain no FC frame header"
        });
      }

      for (const frame of frames) {
        const receivedAt = new Date();
        const crcCheck = isValidCrc(frame);
        if (!crcCheck.ok) {
          console.log(`${logPrefix({ dir: "in", tag: "Xexun", at: receivedAt })} CRC invalid, ignoring frame: ${toHex(frame)}`);
          recordTcpInbound(store, socket, "frame_crc_invalid", {
            byteLength: frame.length,
            rawHex: toHex(frame),
            asciiPreview: asciiPreview(frame),
            note: crcCheck.reason || "crc invalid"
          });
          continue;
        }

        const parsed = parseXexunPacket(frame);
        if (!parsed) {
          console.log(`${logPrefix({ dir: "in", tag: "Xexun", at: receivedAt })} Unparsed frame: ${toHex(frame)}`);
          recordTcpInbound(store, socket, "frame_unparsed", {
            byteLength: frame.length,
            rawHex: toHex(frame),
            asciiPreview: asciiPreview(frame),
            note: "parseXexunPacket returned null"
          });
          continue;
        }

        const rawPayloadFor020 = parsed.messageId === 0x20 ? frame.subarray(14, frame.length - 3) : null;
        const statusRaw = rawPayloadFor020 ? extractStatusFrom020Payload(rawPayloadFor020) : null;

        // Structured log requested
        const deviceStatus = parsed.deviceStatus || {};
        const logObj = {
          provider: "xexun",
          deviceType: "Xexun",
          listenerPort: port,
          receivedAtCyprus: formatCyprusTime(receivedAt),
          receivedAtUtc: receivedAt.toISOString(),
          imei: parsed.imei,
          messageId: parsed.messageId,
          source: parsed.source ?? null,
          gpsValid: parsed.gpsValid ?? null,
          battery: deviceStatus.battery ?? null,
          signal: parsed.signal ?? null,
          statusRaw: statusRaw
            ? { battery: statusRaw.battery, signal: statusRaw.signal, trackingSeq: statusRaw.trackingSeq }
            : null,
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
        console.log(`${logPrefix({ dir: "in", tag: "Xexun", at: receivedAt })} PARSED: ${JSON.stringify(logObj)}`);
        logDeviceIdentified(DEVICE.XEXUN, {
          imei: parsed.imei,
          message: `msg=0x${parsed.messageId.toString(16)}`,
          port,
        });
        recordTcpInbound(store, socket, "frame_parsed", {
          provider: "xexun",
          imei: parsed.imei ?? null,
          messageId: parsed.messageId ?? null,
          byteLength: frame.length,
          rawHex: toHex(frame),
          parsedJson: safeJson(logObj)
        });

        if (
          parsed.messageId !== 0x20 &&
          parsed.messageId !== 0x21 &&
          parsed.messageId !== 0x6a
        ) {
          console.log(
            `${logPrefix({ dir: "in", tag: "Xexun", at: receivedAt })} Warning: unknown messageId=0x${parsed.messageId.toString(16)} (ACKing anyway)`
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
            const rawPayload = rawPayloadFor020; // payload only (no CRC+CF)

            // Prefer "Successful Tracking Time" from the FIRST GPS block (0x64): [0x64][len][timestamp:4]...
            // Status-only uplinks: use plausible epoch from 0x6A (battery time), same as portal parsing.
            let timestampBytes = null;
            let ackTsSource = null;
            for (let i = 0; i + 6 <= rawPayload.length; i++) {
              if (rawPayload.readUInt8(i) !== 0x64) continue;
              const l = rawPayload.readUInt8(i + 1);
              if (l < 4) continue;
              const end = i + 2 + l;
              if (end > rawPayload.length) continue;
              timestampBytes = rawPayload.subarray(i + 2, i + 6);
              ackTsSource = "0x64";
              break;
            }

            if (!timestampBytes || timestampBytes.length !== 4) {
              const block6a = extractFirst6aRawBlock(rawPayload);
              if (block6a) {
                const ds = parseDeviceStatusBlock(block6a);
                if (ds.timestampBytes && ds.timestampBytes.length === 4) {
                  timestampBytes = ds.timestampBytes;
                  ackTsSource = "0x6A";
                }
              }
            }

            if (!timestampBytes || timestampBytes.length !== 4) {
              throw new Error(
                "Missing timestamp for 0x20 ACK (no 0x64 Successful Tracking Time and no epoch in 0x6A)"
              );
            }

            console.log(
              `${logPrefix({ dir: "out", tag: "Xexun", at: new Date() })} ACK TS SOURCE ${ackTsSource}: ${timestampBytes
                .toString("hex")
                .toUpperCase()}`
            );

            // Important: ACK must echo the exact incoming sequence byte (same offset as parseXexunPacket).
            const incomingSeq = frame.readUInt8(5);
            if ((incomingSeq & 0xff) !== (parsed.sequence & 0xff)) {
              console.log(
                `${logPrefix({ dir: "out", tag: "Xexun", at: new Date() })} ACK WARN: frame seq 0x${incomingSeq
                  .toString(16)
                  .padStart(2, "0")} !== parsed.sequence 0x${parsed.sequence
                  .toString(16)
                  .padStart(2, "0")}`
              );
            }
            const gpsDurByte = extractGpsTrackingDurationByte(rawPayload);
            const offsetSeconds = ackOffsetSecondsFor020Ack(statusRaw, rawPayload);
            console.log(
              `${logPrefix({ dir: "out", tag: "Xexun", at: new Date() })} ACK offset: trackingSeq=${statusRaw?.trackingSeq ?? "?"}` +
                ` signal=${statusRaw?.signal ?? "?"} gps0x64Last=${gpsDurByte ?? "?"} → +${offsetSeconds}s`
            );
            const ack = buildAck({ sequence: incomingSeq, imei: imei8, timestampBytes, offsetSeconds });
            socket.write(ack);
            console.log(`${logPrefix({ dir: "out", tag: "Xexun", at: new Date() })} ACK HEX: ${toHex(ack)}`);
          } else {
            const ack = buildAckFrame({
              version: parsed.version,
              messageId: parsed.messageId,
              sequence: parsed.sequence,
              imei8,
              fixedReply
            });
            socket.write(ack);
            console.log(`${logPrefix({ dir: "out", tag: "Xexun", at: new Date() })} ACK HEX: ${toHex(ack)}`);
          }

          // After successful uplink (0x20), push one queued server command (0x21), per Xexun API.
          if (parsed.messageId === 0x20) {
            if (parsed.gpsValid === false && parsed.source === "lbs") {
              console.log(`${logPrefix({ dir: "in", tag: "Xexun" })} GPS invalid → using LBS fallback`);
            }
            sendNextQueuedCommand(socket, parsed.imei, store);
          }
        } catch (e) {
          console.log(`${logPrefix({ dir: "out", tag: "Xexun" })} Failed to send ACK:`, e?.message || String(e));
        }
      }
    });

    socket.on("close", () => {
      store.releaseSocket(socket);
      console.log(`${logPrefix({ dir: "in", tag: "Xexun" })} connection closed`);
      recordTcpInbound(store, socket, "close", { note: "Xexun socket closed", provider: "xexun" });
    });
    socket.on("error", (err) => {
      console.log(`${logPrefix({ dir: "in", tag: "Xexun" })} socket error:`, err.message);
      recordTcpInbound(store, socket, "error", { note: err.message || String(err), provider: "xexun" });
    });
  });

  server.listen(port, () => logListenerReady(DEVICE.XEXUN, port));
  return server;
}

module.exports = { createTcpServer, extractFramesFromStream };

