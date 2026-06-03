const net = require("net");
const {
  parseG365Packet,
  buildG365AckForParsed,
  buildG365ExpiryDate,
  buildG365TimeAck,
  extractFramesFromStream,
  toHex
} = require("../protocol/g365");
const { logPrefix, formatCyprusTime } = require("../logging/time");
const { parseG365LbsCellsFromHex } = require("../geo/g365Lbs");
const { geocodeLbsTowers, LBS_GEOCODE_ENABLED } = require("../geo/lbsGeocode");
const { DEVICE, logDeviceConnect, logDeviceIdentified, logListenerReady } = require("../logging/deviceLog");

function scheduleG365LbsGeocode(store, imei, parsed) {
  if (!LBS_GEOCODE_ENABLED || !imei || parsed?.source !== "lbs") return;
  if (parsed.gps?.lat != null && parsed.gps?.lng != null) return;
  const towers = parseG365LbsCellsFromHex(parsed.lbsRaw, parsed.protocol);
  if (!towers) return;

  void geocodeLbsTowers(towers)
    .then((geo) => {
      if (!geo) {
        console.log(
          `${logPrefix({ dir: "in", tag: "365GPS" })} LBS geocode: no match for ${imei} (MCC ${towers.mcc} MNC ${towers.mnc}, ${towers.cells.length} cells)`
        );
        return;
      }
      console.log(
        `${logPrefix({ dir: "in", tag: "365GPS" })} LBS geocoded ${imei}: ${geo.lat}, ${geo.lng} (${geo.provider})`
      );
      const ts = parsed.deviceStatus?.timestamp ?? parsed.gps?.timestamp ?? new Date().toISOString();
      store.upsert(imei, {
        ...parsed,
        imei,
        provider: "g365",
        source: "lbs",
        accuracy: "lbs",
        gpsValid: false,
        lbsTowerInfo: towers,
        gps: {
          lat: geo.lat,
          lng: geo.lng,
          source: "lbs",
          timestamp: ts,
        },
      });
    })
    .catch((e) => {
      console.log(
        `${logPrefix({ dir: "in", tag: "365GPS" })} LBS geocode error for ${imei}:`,
        e?.message || String(e)
      );
    });
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
    provider: "g365",
    ...patch
  };
  console.log(`${logPrefix({ dir: "in", tag: "365GPS" })} AUDIT ${JSON.stringify(entry)}`);
  if (typeof store.recordTcpInboundRequest === "function") {
    store.recordTcpInboundRequest(entry);
  }
}

function g365ProtocolLabel(protocol) {
  const names = {
    0x01: "login",
    0x10: "gps",
    0x11: "gps",
    0x12: "gps",
    0x13: "status",
    0x15: "heartbeat",
    0x16: "alarm",
    0x17: "wifi-lbs",
    0x18: "lbs",
    0x19: "gps-phone",
    0x1a: "gps-phone",
    0x1b: "time-cal",
    0x30: "expiry",
    0x80: "cmd-ack",
    0x81: "cmd-ack",
  };
  const hex = `0x${protocol.toString(16).padStart(2, "0")}`;
  return names[protocol] ? `${hex} (${names[protocol]})` : hex;
}

const G365_EXPIRY_DATE = String(process.env.G365_EXPIRY_DATE || "20301231").replace(/\D/g, "").slice(0, 8);
const G365_SEND_EXPIRY_ON_LOGIN =
  String(process.env.G365_SEND_EXPIRY_ON_LOGIN ?? "1").trim() !== "0" &&
  String(process.env.G365_SEND_EXPIRY_ON_LOGIN ?? "1").trim().toLowerCase() !== "false";

const G365_SEND_TIME_ON_LOGIN =
  String(process.env.G365_SEND_TIME_ON_LOGIN ?? "1").trim() !== "0" &&
  String(process.env.G365_SEND_TIME_ON_LOGIN ?? "1").trim().toLowerCase() !== "false";

function sendG365LoginHandshake(socket, ack) {
  socket.write(ack);
  console.log(`${logPrefix({ dir: "out", tag: "365GPS", at: new Date() })} ACK HEX (login): ${toHex(ack)}`);
  if (G365_SEND_EXPIRY_ON_LOGIN && G365_EXPIRY_DATE.length === 8) {
    const expiry = buildG365ExpiryDate(G365_EXPIRY_DATE);
    socket.write(expiry);
    console.log(
      `${logPrefix({ dir: "out", tag: "365GPS", at: new Date() })} EXPIRY HEX (${G365_EXPIRY_DATE}): ${toHex(expiry)}`
    );
  }
  if (G365_SEND_TIME_ON_LOGIN) {
    const timeAck = buildG365TimeAck();
    socket.write(timeAck);
    console.log(`${logPrefix({ dir: "out", tag: "365GPS", at: new Date() })} TIME SYNC HEX: ${toHex(timeAck)}`);
  }
}

function createG365TcpServer({ port, store }) {
  const server = net.createServer((socket) => {
    socket.setKeepAlive(true);
    socket.setNoDelay(true);
    socket._g365Imei = null;

    logDeviceConnect(DEVICE.G365, socket, port);
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

      if (frames.length === 0 && pending.length >= 6 && pending.readUInt16BE(0) === 0x7878) {
        const proto = pending.readUInt8(3);
        console.log(
          `${logPrefix({ dir: "in", tag: "365GPS" })} Warning: ${pending.length} bytes with 7878 header but no complete frame yet (protocol=0x${proto.toString(16)}). Waiting for more data or check length-byte framing.`
        );
      }

      for (const frame of frames) {
        const receivedAt = new Date();
        let parsed;
        try {
          parsed = parseG365Packet(frame, socket._g365Imei);
        } catch (e) {
          console.log(
            `${logPrefix({ dir: "in", tag: "365GPS", at: receivedAt })} Parse error: ${e?.message || String(e)} frame=${toHex(frame)}`
          );
          recordTcpInbound(store, socket, "frame_parse_error", {
            byteLength: frame.length,
            rawHex: toHex(frame),
            note: e?.message || String(e)
          });
          continue;
        }
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
          deviceType: "365GPS",
          listenerPort: port,
          imei: imei ?? null,
          protocol: parsed.protocol,
          protocolLabel: g365ProtocolLabel(parsed.protocol),
          source: parsed.source ?? null,
          gpsValid: parsed.gpsValid ?? null,
          battery: parsed.deviceStatus?.battery ?? parsed.statusDetail?.battery ?? null,
          signal: parsed.signal ?? parsed.deviceStatus?.signal ?? parsed.statusDetail?.signal ?? null,
          charging: parsed.deviceStatus?.chargingStatus ?? parsed.statusDetail?.charging ?? null,
          chargingEvent: parsed.chargingEvent ?? null,
          timestamp: parsed.deviceStatus?.timestamp ?? parsed.gps?.timestamp ?? null,
          lat: parsed.gps?.lat ?? null,
          lng: parsed.gps?.lng ?? null,
          wifiBssids: parsed.wifiBssids ?? null,
          raw: parsed.rawHex
        };
        console.log(`${logPrefix({ dir: "in", tag: "365GPS", at: receivedAt })} PARSED: ${JSON.stringify(logObj)}`);
        if (imei) {
          logDeviceIdentified(DEVICE.G365, {
            imei,
            message: `protocol=${g365ProtocolLabel(parsed.protocol)}`,
            port,
          });
        }
        recordTcpInbound(store, socket, "frame_parsed", {
          provider: "g365",
          imei: imei ?? null,
          messageId: parsed.protocol ?? null,
          byteLength: frame.length,
          rawHex: toHex(frame),
          parsedJson: safeJson(logObj),
          note: "g365"
        });

        if (imei) {
          store.upsert(imei, {
            ...parsed,
            imei,
            provider: "g365",
            receivedAt: receivedAt.toISOString(),
          });
          store.bindSocket(imei, socket);
          scheduleG365LbsGeocode(store, imei, parsed);
        }

        try {
          const ack = buildG365AckForParsed(parsed, frame);
          if (ack) {
            if (parsed.protocol === 0x01) {
              sendG365LoginHandshake(socket, ack);
            } else {
              socket.write(ack);
              console.log(`${logPrefix({ dir: "out", tag: "365GPS", at: new Date() })} ACK HEX: ${toHex(ack)}`);
            }
          } else if (parsed.protocol === 0x01) {
            console.log(`${logPrefix({ dir: "out", tag: "365GPS" })} Warning: login frame received but no ACK built`);
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

  server.listen(port, () => logListenerReady(DEVICE.G365, port));
  return server;
}

module.exports = { createG365TcpServer, extractFramesFromStream };
