const net = require("net");
const {
  parseG365Packet,
  buildG365AckForParsed,
  extractFramesFromStream,
  toHex
} = require("../protocol/g365");
const { logPrefix, formatCyprusTime } = require("../logging/time");

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
    provider: "g365",
    ...patch
  };
  console.log(`${logPrefix({ dir: "in", tag: "365GPS" })} AUDIT ${JSON.stringify(entry)}`);
  if (typeof store.recordTcpInboundRequest === "function") {
    store.recordTcpInboundRequest(entry);
  }
}

function createG365TcpServer({ port, store }) {
  const server = net.createServer((socket) => {
    socket.setKeepAlive(true);
    socket.setNoDelay(true);
    socket._g365Imei = null;

    console.log(
      `${logPrefix({ dir: "in", tag: "365GPS" })} connection from ${socket.remoteAddress}:${socket.remotePort}`
    );
    recordTcpInbound(store, socket, "connection", { note: "365GPS socket connected" });

    let pending = Buffer.alloc(0);

    socket.on("data", (data) => {
      console.log(`${logPrefix({ dir: "in", tag: "365GPS" })} RAW HEX: ${toHex(data)}`);
      recordTcpInbound(store, socket, "data", {
        byteLength: data.length,
        rawHex: toHex(data),
        asciiPreview: asciiPreview(data)
      });

      pending = Buffer.concat([pending, data]);
      const { frames, rest } = extractFramesFromStream(pending);
      pending = rest;

      if (frames.length === 0 && pending.length > 0 && pending.indexOf(Buffer.from([0x78, 0x78])) === -1) {
        console.log(
          `${logPrefix({ dir: "in", tag: "365GPS" })} Warning: ${pending.length} bytes with no 7878 header (not 365GPS framing).`
        );
      }

      for (const frame of frames) {
        const receivedAt = new Date();
        const parsed = parseG365Packet(frame, socket._g365Imei);
        if (!parsed) {
          console.log(`${logPrefix({ dir: "in", tag: "365GPS", at: receivedAt })} Unparsed frame: ${toHex(frame)}`);
          recordTcpInbound(store, socket, "frame_unparsed", {
            byteLength: frame.length,
            rawHex: toHex(frame),
            note: "parseG365Packet returned null"
          });
          continue;
        }

        if (parsed.imei) {
          socket._g365Imei = parsed.imei;
        }

        const imei = parsed.imei || socket._g365Imei;
        if (!imei) {
          console.log(
            `${logPrefix({ dir: "in", tag: "365GPS", at: receivedAt })} Frame 0x${parsed.protocol.toString(16)} before login (no IMEI yet)`
          );
        }

        const logObj = {
          receivedAtCyprus: formatCyprusTime(receivedAt),
          receivedAtUtc: receivedAt.toISOString(),
          provider: "g365",
          imei: imei ?? null,
          protocol: parsed.protocol,
          source: parsed.source ?? null,
          gpsValid: parsed.gpsValid ?? null,
          battery: parsed.deviceStatus?.battery ?? null,
          signal: parsed.signal ?? parsed.deviceStatus?.signal ?? null,
          timestamp: parsed.deviceStatus?.timestamp ?? parsed.gps?.timestamp ?? null,
          lat: parsed.gps?.lat ?? null,
          lng: parsed.gps?.lng ?? null,
          wifiBssids: parsed.wifiBssids ?? null,
          raw: parsed.rawHex
        };
        console.log(`${logPrefix({ dir: "in", tag: "365GPS", at: receivedAt })} PARSED: ${JSON.stringify(logObj)}`);
        recordTcpInbound(store, socket, "frame_parsed", {
          imei: imei ?? null,
          messageId: parsed.protocol ?? null,
          byteLength: frame.length,
          rawHex: toHex(frame),
          parsedJson: safeJson(logObj),
          note: "g365"
        });

        if (imei) {
          store.upsert(imei, parsed);
          store.bindSocket(imei, socket);
        }

        try {
          const ack = buildG365AckForParsed(parsed, frame);
          if (ack) {
            socket.write(ack);
            console.log(`${logPrefix({ dir: "out", tag: "365GPS", at: new Date() })} ACK HEX: ${toHex(ack)}`);
          }
        } catch (e) {
          console.log(`${logPrefix({ dir: "out", tag: "365GPS" })} Failed to send ACK:`, e?.message || String(e));
        }
      }
    });

    socket.on("close", () => {
      store.releaseSocket(socket);
      console.log(`${logPrefix({ dir: "in", tag: "365GPS" })} connection closed`);
      recordTcpInbound(store, socket, "close", { note: "365GPS socket closed" });
    });
    socket.on("error", (err) => {
      console.log(`${logPrefix({ dir: "in", tag: "365GPS" })} socket error:`, err.message);
      recordTcpInbound(store, socket, "error", { note: err.message || String(err) });
    });
  });

  server.listen(port, () => console.log(`365GPS TCP server listening on port ${port}`));
  return server;
}

module.exports = { createG365TcpServer, extractFramesFromStream };
