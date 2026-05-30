/**
 * HTTP helpers for 365GPS / Zhongxun server → device commands.
 */
const {
  buildG365ServerRedirect,
  buildG365ManualPosition,
  buildG365StatusInterval,
  buildG365HeartbeatInterval,
  buildG365ProhibitLbs,
  buildG365PowerControl,
  buildG365FindDevice,
  buildG365OverspeedLimit,
  buildG365UploadInterval,
  buildG365PhoneNumber,
  buildG365ExpiryDate,
  toHex
} = require("../protocol/g365");
const { logPrefix } = require("../logging/time");

function sendG365Frame(store, imei, frame, res, meta = {}) {
  const socket = store.getSocket(String(imei));
  if (!socket || socket.destroyed) {
    return res.status(503).json({
      error: "device_offline",
      imei: String(imei),
      hint: "365GPS device must have an active TCP session on GPS365_TCP_PORT"
    });
  }
  socket.write(frame);
  console.log(`${logPrefix({ dir: "out", tag: "365GPS" })} CMD → ${imei}: ${meta.command || "frame"}`);
  console.log(`${logPrefix({ dir: "out", tag: "365GPS" })} CMD HEX: ${toHex(frame)}`);
  return res.json({
    ok: true,
    imei: String(imei),
    command: meta.command || null,
    hex: toHex(frame),
    ...meta
  });
}

function parseHexFrame(raw) {
  const hex = String(raw || "")
    .replace(/\s+/g, "")
    .replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("invalid_hex");
  }
  return Buffer.from(hex, "hex");
}

/**
 * @param {import("express").Express} app
 * @param {ReturnType<import("../store/memory").createMemoryStore>} store
 */
function registerG365HttpApi(app, store) {
  app.get("/api/g365", (_req, res) => {
    res.json({
      service: "365GPS / Zhongxun protocol",
      documentation: "docs/G365_PROTOCOL.md",
      tcpPortEnv: "GPS365_TCP_PORT",
      defaultTcpPort: 5003,
      commands: [
        { method: "POST", path: "/api/g365/commands/server-redirect", body: "{ imei, host, port }" },
        { method: "POST", path: "/api/g365/commands/manual-position", body: "{ imei, mode?: 'gps'|'wifi' }" },
        { method: "POST", path: "/api/g365/commands/upload-interval", body: "{ imei, seconds }" },
        { method: "POST", path: "/api/g365/commands/status-interval", body: "{ imei, minutes }" },
        { method: "POST", path: "/api/g365/commands/heartbeat-interval", body: "{ imei, seconds }" },
        { method: "POST", path: "/api/g365/commands/prohibit-lbs", body: "{ imei, enabled: true|false }" },
        { method: "POST", path: "/api/g365/commands/power", body: "{ imei, operation: 'restart'|'shutdown' }" },
        { method: "POST", path: "/api/g365/commands/find", body: "{ imei, start: true|false }" },
        { method: "POST", path: "/api/g365/commands/overspeed", body: "{ imei, kmh }" },
        { method: "POST", path: "/api/g365/commands/phone", body: "{ imei, role: 'sos'|'dad'|'mom'|'monitor', number }" },
        { method: "POST", path: "/api/g365/commands/expiry-date", body: "{ imei, yyyymmdd }" },
        { method: "POST", path: "/api/g365/commands/raw", body: "{ imei, hex }" }
      ]
    });
  });

  app.post("/api/g365/commands/server-redirect", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const host = String(req.body?.host || "").trim();
    const port = Number(req.body?.port ?? process.env.GPS365_TCP_PORT ?? 5003);
    if (!imei || !host) {
      return res.status(400).json({ error: "missing_imei_or_host", hint: "JSON { imei, host, port? }" });
    }
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return res.status(400).json({ error: "invalid_port" });
    }
    let frame;
    try {
      frame = buildG365ServerRedirect({ ip: host, port });
    } catch (e) {
      return res.status(400).json({ error: "invalid_host", message: e.message });
    }
    return sendG365Frame(store, imei, frame, res, {
      command: `0x66 redirect → ${host}:${port}`,
      g365: "Server IP/port change (device reconnects)"
    });
  });

  app.post("/api/g365/commands/manual-position", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const mode = String(req.body?.mode || "gps").toLowerCase() === "wifi" ? "wifi" : "gps";
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    const frame = buildG365ManualPosition(mode);
    return sendG365Frame(store, imei, frame, res, {
      command: `0x80 manual position (${mode})`,
      g365: "Request immediate location upload"
    });
  });

  app.post("/api/g365/commands/upload-interval", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const seconds = Number(req.body?.seconds);
    if (!imei || !Number.isFinite(seconds)) {
      return res.status(400).json({ error: "missing_imei_or_seconds" });
    }
    return sendG365Frame(store, imei, buildG365UploadInterval(seconds), res, {
      command: `0x97 upload interval ${seconds}s`
    });
  });

  app.post("/api/g365/commands/status-interval", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const minutes = Number(req.body?.minutes);
    if (!imei || !Number.isFinite(minutes)) {
      return res.status(400).json({ error: "missing_imei_or_minutes" });
    }
    return sendG365Frame(store, imei, buildG365StatusInterval(minutes), res, {
      command: `0x13 status interval ${minutes} min`
    });
  });

  app.post("/api/g365/commands/heartbeat-interval", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const seconds = Number(req.body?.seconds);
    if (!imei || !Number.isFinite(seconds)) {
      return res.status(400).json({ error: "missing_imei_or_seconds" });
    }
    return sendG365Frame(store, imei, buildG365HeartbeatInterval(seconds), res, {
      command: `0x13 heartbeat interval ${seconds}s`
    });
  });

  app.post("/api/g365/commands/prohibit-lbs", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    const enabled = req.body?.enabled !== false && req.body?.enabled !== 0;
    return sendG365Frame(store, imei, buildG365ProhibitLbs(enabled), res, {
      command: `0x33 prohibit LBS ${enabled ? "on" : "off"}`
    });
  });

  app.post("/api/g365/commands/power", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const operation = String(req.body?.operation || "restart").toLowerCase() === "shutdown" ? "shutdown" : "restart";
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    return sendG365Frame(store, imei, buildG365PowerControl(operation), res, {
      command: `0x48 ${operation}`
    });
  });

  app.post("/api/g365/commands/find", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    const start = req.body?.start !== false && req.body?.start !== 0;
    return sendG365Frame(store, imei, buildG365FindDevice(start), res, {
      command: `0x49 find ${start ? "start" : "stop"}`
    });
  });

  app.post("/api/g365/commands/overspeed", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const kmh = Number(req.body?.kmh);
    if (!imei || !Number.isFinite(kmh)) {
      return res.status(400).json({ error: "missing_imei_or_kmh" });
    }
    return sendG365Frame(store, imei, buildG365OverspeedLimit(kmh), res, {
      command: `0x86 overspeed ${kmh} km/h`
    });
  });

  app.post("/api/g365/commands/phone", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const number = String(req.body?.number || "").trim();
    const role = String(req.body?.role || "sos").toLowerCase();
    const protoByRole = { monitor: 0x40, sos: 0x41, dad: 0x42, mom: 0x43 };
    const protocol = protoByRole[role];
    if (!imei || !number || protocol == null) {
      return res.status(400).json({ error: "missing_imei_number_or_role" });
    }
    return sendG365Frame(store, imei, buildG365PhoneNumber(protocol, number), res, {
      command: `0x${protocol.toString(16)} phone ${number}`
    });
  });

  app.post("/api/g365/commands/expiry-date", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const yyyymmdd = String(req.body?.yyyymmdd || "").trim();
    if (!imei || !/^\d{8}$/.test(yyyymmdd)) {
      return res.status(400).json({ error: "missing_imei_or_yyyymmdd" });
    }
    return sendG365Frame(store, imei, buildG365ExpiryDate(yyyymmdd), res, {
      command: `0x30 expiry ${yyyymmdd}`
    });
  });

  app.post("/api/g365/commands/raw", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    let frame;
    try {
      frame = parseHexFrame(req.body?.hex);
    } catch {
      return res.status(400).json({ error: "invalid_hex" });
    }
    if (frame.length < 5 || frame.readUInt16BE(0) !== 0x7878) {
      return res.status(400).json({ error: "not_g365_frame", hint: "Frame must start with 7878" });
    }
    return sendG365Frame(store, imei, frame, res, { command: "raw frame" });
  });
}

module.exports = { registerG365HttpApi };
