const net = require("net");
const {
  parseGt06Packet,
  buildGt06AckForParsed,
  extractFramesFromStream,
  verifyFrameCrc,
  toHex,
  PROTO,
} = require("../protocol/gt06");
const { logPrefix, formatCyprusTime } = require("../logging/time");
const { DEVICE, logDeviceConnect, logDeviceIdentified, logListenerReady } = require("../logging/deviceLog");
const { promoteCloudDeviceToDirectTcp } = require("../directTcpPromote");

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
    provider: "gt06",
    ...patch,
  };
  console.log(`${logPrefix({ dir: "in", tag: "GT06" })} AUDIT ${JSON.stringify(entry)}`);
  if (typeof store.recordTcpInboundRequest === "function") {
    store.recordTcpInboundRequest(entry);
  }
}

function gt06ProtocolLabel(protocol) {
  const names = {
    [PROTO.LOGIN]: "login",
    [PROTO.LOCATION]: "location",
    [PROTO.STATUS]: "status",
    [PROTO.STRING]: "string",
    [PROTO.ALARM]: "alarm",
    [PROTO.GPS_PHONE]: "gps-phone",
    [PROTO.COMMAND]: "command",
  };
  const hex = `0x${Number(protocol).toString(16).padStart(2, "0")}`;
  return names[protocol] ? `${hex} (${names[protocol]})` : hex;
}

/** True when frame has GT06 length + CRC-ITU (distinct from 365GPS). */
function isGt06Frame(frame) {
  return verifyFrameCrc(frame);
}

/**
 * Parse one GT06 frame, upsert store, bind socket, send ACK.
 * @returns {boolean} true if handled as GT06 (including rejected CRC/parse)
 */
function processGt06Frame({ store, socket, frame, port, receivedAt = new Date() }) {
  let parsed;
  try {
    parsed = parseGt06Packet(frame, socket._gt06Imei || socket._g365Imei || null);
  } catch (e) {
    console.log(
      `${logPrefix({ dir: "in", tag: "GT06", at: receivedAt })} Parse error: ${e?.message || String(e)} frame=${toHex(frame)}`
    );
    recordTcpInbound(store, socket, "frame_parse_error", {
      byteLength: frame.length,
      rawHex: toHex(frame),
      note: e?.message || String(e),
    });
    return true;
  }

  if (!parsed?.ok) {
    console.log(
      `${logPrefix({ dir: "in", tag: "GT06", at: receivedAt })} Rejected frame: ${parsed?.error || "unknown"} ${toHex(frame)}`
    );
    recordTcpInbound(store, socket, "frame_rejected", {
      byteLength: frame.length,
      rawHex: toHex(frame),
      note: parsed?.error || "parse_failed",
    });
    return true;
  }

  if (parsed.imei) {
    socket._gt06Imei = parsed.imei;
    // Share IMEI with demuxed 365GPS session fields on the same socket.
    if (!socket._g365Imei) socket._g365Imei = parsed.imei;
  }

  const imei = parsed.imei || socket._gt06Imei || socket._g365Imei;
  if (!imei) {
    console.log(
      `${logPrefix({ dir: "in", tag: "GT06", at: receivedAt })} Frame ${gt06ProtocolLabel(parsed.protocol)} before login (no IMEI yet)`
    );
  }

  const logObj = {
    receivedAtCyprus: formatCyprusTime(receivedAt),
    receivedAtUtc: receivedAt.toISOString(),
    provider: "gt06",
    deviceType: "GT06",
    listenerPort: port,
    imei: imei ?? null,
    protocol: parsed.protocol,
    protocolLabel: gt06ProtocolLabel(parsed.protocol),
    kind: parsed.kind ?? null,
    source: parsed.source ?? null,
    gpsValid: parsed.gpsValid ?? null,
    battery: parsed.battery ?? parsed.deviceStatus?.battery ?? null,
    signal: parsed.signal ?? parsed.deviceStatus?.signal ?? null,
    charging: parsed.charging ?? parsed.deviceStatus?.chargingStatus ?? null,
    alarm: parsed.alarm ?? parsed.deviceStatus?.alarm ?? null,
    timestamp: parsed.deviceStatus?.timestamp ?? parsed.gps?.timestamp ?? null,
    lat: parsed.gps?.lat ?? null,
    lng: parsed.gps?.lng ?? null,
    raw: parsed.rawHex,
  };
  console.log(`${logPrefix({ dir: "in", tag: "GT06", at: receivedAt })} PARSED: ${JSON.stringify(logObj)}`);
  if (imei) {
    logDeviceIdentified(DEVICE.GT06, {
      imei,
      message: `protocol=${gt06ProtocolLabel(parsed.protocol)}`,
      port,
    });
  }
  recordTcpInbound(store, socket, "frame_parsed", {
    provider: "gt06",
    imei: imei ?? null,
    messageId: parsed.protocol ?? null,
    byteLength: frame.length,
    rawHex: toHex(frame),
    parsedJson: safeJson(logObj),
    note: "gt06",
  });

  if (imei) {
    store.upsert(imei, {
      ...parsed,
      imei,
      provider: "gt06",
      battery: parsed.battery ?? parsed.deviceStatus?.battery ?? undefined,
      signal: parsed.signal ?? parsed.deviceStatus?.signal ?? undefined,
      charging: parsed.charging ?? parsed.deviceStatus?.chargingStatus ?? undefined,
      receivedAt: receivedAt.toISOString(),
    });
    store.bindSocket(imei, socket);
    const promoted = promoteCloudDeviceToDirectTcp(store, imei, "gt06");
    if (promoted?.switched) {
      console.log(
        `${logPrefix({ dir: "in", tag: "GT06" })} Auto-switched ${imei} from ${promoted.from} cloud poll → gt06 TCP (users now see live TCP)`
      );
    }
  }

  try {
    const ack = buildGt06AckForParsed(parsed);
    if (ack) {
      socket.write(ack);
      console.log(`${logPrefix({ dir: "out", tag: "GT06", at: new Date() })} ACK HEX: ${toHex(ack)}`);
    } else if (parsed.protocol === PROTO.LOGIN) {
      console.log(`${logPrefix({ dir: "out", tag: "GT06" })} Warning: login frame received but no ACK built`);
    }
  } catch (e) {
    console.log(`${logPrefix({ dir: "out", tag: "GT06" })} Failed to send ACK:`, e?.message || String(e));
  }

  return true;
}

function createGt06TcpServer({ port, store }) {
  const server = net.createServer((socket) => {
    socket.setKeepAlive(true);
    socket.setNoDelay(true);
    socket._gt06Imei = null;

    logDeviceConnect(DEVICE.GT06, socket, port);
    recordTcpInbound(store, socket, "connection", { note: "GT06 socket connected" });

    let pending = Buffer.alloc(0);

    socket.on("data", (data) => {
      console.log(`${logPrefix({ dir: "in", tag: "GT06" })} RAW HEX: ${toHex(data)}`);
      recordTcpInbound(store, socket, "data", {
        byteLength: data.length,
        rawHex: toHex(data),
        asciiPreview: asciiPreview(data),
      });

      pending = Buffer.concat([pending, data]);
      const { frames, rest } = extractFramesFromStream(pending);
      pending = rest;

      if (frames.length === 0 && pending.length > 0 && pending.indexOf(Buffer.from([0x78, 0x78])) === -1) {
        console.log(
          `${logPrefix({ dir: "in", tag: "GT06" })} Warning: ${pending.length} bytes with no 7878 header (not GT06 framing).`
        );
      }

      if (frames.length === 0 && pending.length >= 6 && pending.readUInt16BE(0) === 0x7878) {
        const proto = pending.readUInt8(3);
        console.log(
          `${logPrefix({ dir: "in", tag: "GT06" })} Warning: ${pending.length} bytes with 7878 header but no complete frame yet (protocol=0x${proto.toString(16)}). Waiting for more data.`
        );
      }

      for (const frame of frames) {
        processGt06Frame({ store, socket, frame, port, receivedAt: new Date() });
      }
    });

    socket.on("close", () => {
      store.releaseSocket(socket);
      console.log(`${logPrefix({ dir: "in", tag: "GT06" })} connection closed`);
      recordTcpInbound(store, socket, "close", { note: "GT06 socket closed" });
    });
    socket.on("error", (err) => {
      console.log(`${logPrefix({ dir: "in", tag: "GT06" })} socket error:`, err.message);
      recordTcpInbound(store, socket, "error", { note: err.message || String(err) });
    });
  });

  server.listen(port, () => logListenerReady(DEVICE.GT06, port));
  return server;
}

module.exports = {
  createGt06TcpServer,
  extractFramesFromStream,
  processGt06Frame,
  isGt06Frame,
  gt06ProtocolLabel,
};
