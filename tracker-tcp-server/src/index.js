const express = require("express");
const cors = require("cors");

const { createMemoryStore } = require("./store/memory");
const { createTcpServer } = require("./tcp/handler");

const TCP_PORT = Number(process.env.TCP_PORT || 5001);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);

const store = createMemoryStore();

createTcpServer({ port: TCP_PORT, store });

const app = express();
app.use(express.json({ limit: "32kb" }));

function corsOrigin() {
  const raw = process.env.HTTP_CORS_ORIGIN;
  if (!raw || String(raw).trim() === "" || String(raw).trim() === "*") return true;
  const list = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  return list;
}

app.use(
  cors({
    origin: corsOrigin(),
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.get("/devices", (req, res) => {
  res.json(store.list());
});

app.get("/devices/:imei", (req, res) => {
  const d = store.get(req.params.imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json(d);
});

/**
 * Queue any 0x21 command text (see Xexun API — e.g. ip=p.xexun.com:8899, tk=..., tz=...).
 * The frame is sent on the device's next TCP uplink (message 0x20) after ACK.
 */
app.post("/commands/queue", (req, res) => {
  const imei = String(req.body?.imei || req.query?.imei || "").trim();
  const command = String(req.body?.command || "").trim();
  if (!imei || !command) {
    return res.status(400).json({ error: "missing_imei_or_command" });
  }
  store.enqueueCommand(imei, command);
  res.json({
    ok: true,
    imei,
    queued: command,
    pending: store.pendingCommands(imei),
    note: "Delivered on next device uplink after ACK (usually seconds to minutes)."
  });
});

/**
 * Convenience: IP transfer / server switch — same as vendor doc `ip=host:port`.
 * Example body: { "imei": "869469088344608", "host": "116.203.209.68", "port": 5001 }
 */
app.post("/commands/ip-transfer", (req, res) => {
  const imei = String(req.body?.imei || "").trim();
  const host = String(req.body?.host || req.body?.ip || "").trim().replace(/^\/\//, "");
  const port = Number(req.body?.port ?? process.env.TCP_PORT ?? 5001);
  if (!imei || !host) {
    return res.status(400).json({ error: "missing_imei_or_host", hint: "Send JSON { imei, host, port? }" });
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return res.status(400).json({ error: "invalid_port" });
  }
  const command = `ip=${host}:${port}`;
  store.enqueueCommand(imei, command);
  res.json({
    ok: true,
    imei,
    command,
    pending: store.pendingCommands(imei),
    note: "Device switches TCP server after it accepts this 0x21 command (next uplink)."
  });
});

app.get("/commands/pending/:imei", (req, res) => {
  const imei = String(req.params.imei || "").trim();
  if (!imei) return res.status(400).json({ error: "missing_imei" });
  res.json({ imei, pending: store.pendingCommands(imei) });
});

app.get("/position", (req, res) => {
  const imei = String(req.query.deviceId || req.query.imei || "").trim();
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  const d = store.get(imei);
  if (!d) return res.status(404).json({ error: "not_found" });

  const gps = d.gps || {};
  const lat = gps.lat != null ? Number(gps.lat) : Number.NaN;
  const lng = gps.lng != null ? Number(gps.lng) : Number.NaN;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(404).json({ error: "no_position" });
  }

  res.json({
    lat,
    lng,
    speed: gps.speedKmh != null ? Number(gps.speedKmh) : null,
    address: null,
    deviceTime: gps.timestamp || null,
    serverTime: d.receivedAt || null
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
  console.log(`- GET http://localhost:${HTTP_PORT}/devices`);
  console.log(`- GET http://localhost:${HTTP_PORT}/devices/:imei`);
});

