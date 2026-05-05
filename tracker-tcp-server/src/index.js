const express = require("express");
const cors = require("cors");

const { createMemoryStore } = require("./store/memory");
const { createTcpServer } = require("./tcp/handler");

const TCP_PORT = Number(process.env.TCP_PORT || 5001);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);

const store = createMemoryStore();

createTcpServer({ port: TCP_PORT, store });

const app = express();

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

