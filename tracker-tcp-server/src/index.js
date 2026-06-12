const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { createMemoryStore } = require("./store/memory");
const { createSqliteStore } = require("./store/sqliteStore");
const { createTcpServer } = require("./tcp/handler");
const { createG365TcpServer } = require("./tcp/g365Handler");
const { registerXexunHttpApi } = require("./http/xexunApiRoutes");
const { registerG365HttpApi } = require("./http/g365ApiRoutes");
const { registerGpsposHttpApi } = require("./http/gpsposApiRoutes");
const { registerAdminDeviceRoutes } = require("./http/adminDeviceRoutes");
const { logPrefix } = require("./logging/time");
const { buildPositionPayload } = require("./http/positionPayload");
const { inferDeviceProvider } = require("./deviceProvider");

function withProvider(d) {
  if (!d) return d;
  const provider = d.provider || inferDeviceProvider(d);
  return provider && d.provider !== provider ? { ...d, provider } : d;
}

const TCP_PORT = Number(process.env.TCP_PORT || 5001);
const GPS365_TCP_PORT = Number(process.env.GPS365_TCP_PORT || 5003);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);
const GPS365_TCP_ENABLED =
  String(process.env.GPS365_TCP_ENABLED ?? "1").trim() !== "0" &&
  String(process.env.GPS365_TCP_ENABLED ?? "1").trim().toLowerCase() !== "false";

/** Production path is set in ecosystem.config.cjs (/var/lib/petpal). Local dev default: */
const DEFAULT_SQLITE_PATH = path.join(__dirname, "..", "data", "petpal.sqlite");
const SQLITE_PATH = process.env.SQLITE_PATH || DEFAULT_SQLITE_PATH;
const PERSIST_TO_SQLITE = String(process.env.PERSIST_TO_SQLITE || "1") !== "0";

const store = PERSIST_TO_SQLITE ? createSqliteStore({ dbPath: SQLITE_PATH }) : createMemoryStore();
if (PERSIST_TO_SQLITE) {
  console.log(`[db] SQLite enabled at ${store.sqlitePath}`);
  if (typeof store.countPositions === "function") {
    const n = store.countPositions();
    console.log(`[db] ${n} position rows on disk (persists across pm2 restart)`);
  }
} else {
  console.warn("[db] PERSIST_TO_SQLITE=0 — all GPS data is in RAM only and is LOST on pm2 restart");
}

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
if (GPS365_TCP_ENABLED) {
  createG365TcpServer({ port: GPS365_TCP_PORT, store });
} else {
  console.log("[365GPS] GPS365_TCP_ENABLED=0 — 365GPS listener disabled");
}
const GPSPOS_ENABLED =
  String(process.env.GPSPOS_ENABLED ?? "0").trim() !== "0" &&
  String(process.env.GPSPOS_ENABLED ?? "0").trim().toLowerCase() !== "false";

console.log(
  `[tracker] Device listeners: Xexun → TCP ${TCP_PORT} (FC…CF) | 365GPS → TCP ${GPS365_TCP_ENABLED ? GPS365_TCP_PORT : "disabled"} (7878…0D0A) | gpspos cloud → ${GPSPOS_ENABLED ? "enabled" : "disabled"} | HTTP API → ${HTTP_PORT}`
);

const app = express();
app.use(express.json({ limit: "64kb" }));

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

// Request audit (http_requests)
app.use((req, res, next) => {
  const start = Date.now();
  res.locals.requestUser = req.header("x-user") || req.header("x-user-id") || null;
  console.log(
    `${logPrefix({ dir: "http_in", tag: "HTTP" })} REQUEST ${req.method} ${req.originalUrl || req.path} ` +
      `ip=${req.ip || req.socket?.remoteAddress || "-"} query=${safeJsonStringify(req.query) || "{}"} body=${
        safeJsonStringify(req.body) || "{}"
      }`
  );

  res.on("finish", () => {
    const latencyMs = Date.now() - start;
    console.log(
      `${logPrefix({ dir: "http_in", tag: "HTTP" })} ${req.method} ${req.originalUrl || req.path} → ${
        res.statusCode
      } (${latencyMs}ms)`
    );
    if (typeof store.recordHttpRequest !== "function") return;
    store.recordHttpRequest({
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      queryJson: safeJsonStringify(req.query),
      bodyJson: safeJsonStringify(req.body),
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.header("user-agent") || null,
      statusCode: res.statusCode,
      latencyMs
    });
  });

  next();
});

function corsOrigin() {
  const raw = process.env.HTTP_CORS_ORIGIN;
  if (!raw || String(raw).trim() === "" || String(raw).trim() === "*") return true;
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

app.use(
  cors({
    origin: corsOrigin(),
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-PetPal-Admin-Token", "X-PetPal-Admin"],
  })
);


registerXexunHttpApi(app, store);
registerG365HttpApi(app, store);
registerGpsposHttpApi(app, store);
registerAdminDeviceRoutes(app, store);

// -----------------------------------------------------------------------------
// App API (frontend-safe) — keep /devices & /position as legacy, but also expose
// the documented /api/app/* paths used by the PetPal UI.
// -----------------------------------------------------------------------------

app.get("/api/app/devices", (req, res) => {
  res.json(store.list().map((d) => withProvider(d)));
});

app.get("/api/app/devices/:imei", (req, res) => {
  const d = store.get(req.params.imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json(withProvider(d));
});

app.get("/api/app/position", (req, res) => {
  const imei = String(req.query.deviceId || req.query.imei || "").trim();
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  const d = store.get(imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  const payload = buildPositionPayload(imei, withProvider(d));
  if (payload.error === "no_position") return res.status(404).json({ error: "no_position" });
  res.json(payload);
});

app.get("/api/app/history", (req, res) => {
  const imei = String(req.query.deviceId || req.query.imei || "").trim();
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  if (typeof store.history !== "function") {
    return res.json({ imei, history: [], note: "History available only when SQLite persistence is enabled." });
  }
  const limit = Number(req.query.limit ?? 100);
  const from = String(req.query.from || "").trim() || null;
  const to = String(req.query.to || "").trim() || null;
  let calendarMatch = true;
  let history = store.history(imei, { limit, from, to });
  let totalInRange = null;
  let truncated = false;
  if (from && to && typeof store.countHistoryInRange === "function") {
    totalInRange = store.countHistoryInRange(imei, { from, to });
    truncated =
      Number.isFinite(totalInRange) &&
      Array.isArray(history) &&
      history.length > 0 &&
      totalInRange > history.length;
  }
  res.json({ imei, history, calendarMatch, totalInRange, truncated });
});

app.post("/api/app/home", (req, res) => {
  const imei = String(req.body?.deviceId || req.body?.imei || "").trim();
  const lat = req.body?.lat != null ? Number(req.body.lat) : Number.NaN;
  const lng = req.body?.lng != null ? Number(req.body.lng) : Number.NaN;
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "missing_lat_lng" });
  }
  if (typeof store.setHomeLocation !== "function") {
    return res.status(501).json({ error: "home_location_not_supported" });
  }
  const ok = store.setHomeLocation(imei, lat, lng);
  if (!ok) return res.status(400).json({ error: "invalid_coordinates" });
  res.json({ ok: true, imei, homeLat: lat, homeLng: lng });
});

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
  const payload = buildPositionPayload(imei, d);
  if (payload.error === "no_position") return res.status(404).json({ error: "no_position" });
  res.json(payload);
});

//
// ✅ 2. STATIC FILES
//
const WEB_BUILD_DIR =
  process.env.WEB_BUILD_DIR || path.resolve(__dirname, "..", "..", "petpal", "build");
const WEB_INDEX_HTML = path.join(WEB_BUILD_DIR, "index.html");

if (fs.existsSync(WEB_INDEX_HTML)) {
  app.use(express.static(WEB_BUILD_DIR));
} else {
  console.warn(
    `[web] React build not found (${WEB_INDEX_HTML}) — API only. Run: cd petpal && npm run build`
  );
}

//
// ✅ 3. SAFE FALLBACK (NO "*")
// 
app.use((req, res) => {
  if (fs.existsSync(WEB_INDEX_HTML)) {
    return res.sendFile(WEB_INDEX_HTML);
  }
  return res.status(404).json({ error: "not_found" });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
});
