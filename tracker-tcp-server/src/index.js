const express = require("express");
const cors = require("cors");

const { createMemoryStore } = require("./store/memory");
const { createTcpServer } = require("./tcp/handler");
const { registerXexunHttpApi } = require("./http/xexunApiRoutes");

const TCP_PORT = Number(process.env.TCP_PORT || 5001);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);

const store = createMemoryStore();

/** Optional demo/fixture: preload one IMEI so GET /devices and /position work before TCP connects. */
function seedSampleDeviceFromEnv() {
  const imei = String(process.env.SEED_DEVICE_IMEI || "").trim();
  if (!imei) return;
  const lat = Number(process.env.SEED_DEVICE_LAT);
  const lng = Number(process.env.SEED_DEVICE_LNG);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.warn(
      "[seed] SEED_DEVICE_IMEI is set but SEED_DEVICE_LAT and SEED_DEVICE_LNG must be valid numbers"
    );
    return;
  }
  store.upsert(imei, {
    imei,
    receivedAt: new Date().toISOString(),
    gps: {
      lat,
      lng,
      speedKmh: null,
      timestamp: new Date().toISOString(),
    },
    seededFromEnv: true,
  });
  console.log(`[seed] Preloaded ${imei} at ${lat}, ${lng} (set SEED_DEVICE_* in env)`);
}

seedSampleDeviceFromEnv();

createTcpServer({ port: TCP_PORT, store });

const app = express();
app.use(express.json({ limit: "64kb" }));

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
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

registerXexunHttpApi(app, store);

app.get("/devices", (req, res) => {
  res.json(store.list());
});

app.get("/devices/:imei", (req, res) => {
  const d = store.get(req.params.imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json(d);
});

app.get("/devices/:imei/status", (req, res) => {
  const d = store.get(req.params.imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json({
    battery: d.battery ?? null,
    signal: d.signal ?? null,
    moving: d.moving ?? null,
    charging: d.charging ?? null,
    steps: d.steps ?? null,
    lastUpdate: d.lastUpdate ?? null
  });
});

app.get("/position", (req, res) => {
  const imei = String(req.query.deviceId || req.query.imei || "").trim();
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  const d = store.get(imei);
  if (!d) return res.status(404).json({ error: "not_found" });

  const loc = d.location || d.gps || {};
  const lat = loc.lat != null ? Number(loc.lat) : Number.NaN;
  const lng = loc.lng != null ? Number(loc.lng) : Number.NaN;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(404).json({ error: "no_position" });
  }

  res.json({
    imei,
    lat,
    lng,
    source: d.source ?? null,
    gpsValid: d.gpsValid === true,
    battery: d.battery ?? null,
    signal: d.signal ?? null,
    steps: d.steps ?? null,
    moving: d.moving ?? null,
    charging: d.charging ?? null,
    speed: d.speed != null ? Number(d.speed) : null,
    lastUpdate: d.lastUpdate ?? null,
    accuracy: d.accuracy ?? (d.source ?? null),
    satellites: d.satellites ?? null
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
  console.log(`- GET  http://localhost:${HTTP_PORT}/  (discovery JSON)`);
  console.log(`- GET  http://localhost:${HTTP_PORT}/devices`);
  console.log(`- POST http://localhost:${HTTP_PORT}/commands/ip-transfer …`);
});
