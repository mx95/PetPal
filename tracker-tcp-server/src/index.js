const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { createMemoryStore } = require("./store/memory");
const { createSqliteStore } = require("./store/sqliteStore");
const { createTcpServer } = require("./tcp/handler");
const { registerXexunHttpApi } = require("./http/xexunApiRoutes");
const { logPrefix } = require("./logging/time");
const { buildPositionPayload } = require("./http/positionPayload");

const TCP_PORT = Number(process.env.TCP_PORT || 5001);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);

/** Always under tracker-tcp-server/data — never depends on PM2 cwd (fixes “empty DB after restart”). */
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
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);


registerXexunHttpApi(app, store);

// -----------------------------------------------------------------------------
// App API (frontend-safe) — keep /devices & /position as legacy, but also expose
// the documented /api/app/* paths used by the PetPal UI.
// -----------------------------------------------------------------------------

app.get("/api/app/devices", (req, res) => {
  res.json(store.list());
});

app.get("/api/app/devices/:imei", (req, res) => {
  const d = store.get(req.params.imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json(d);
});

app.get("/api/app/position", (req, res) => {
  const imei = String(req.query.deviceId || req.query.imei || "").trim();
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  const d = store.get(imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  const payload = buildPositionPayload(imei, d);
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
  if (from && to && Array.isArray(history) && history.length === 0) {
    const lim = Math.min(10000, Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5000);
    history = store.history(imei, { limit: lim });
    calendarMatch = false;
  }
  res.json({ imei, history, calendarMatch });
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

if (fs.existsSync(WEB_BUILD_DIR)) {
  app.use(express.static(WEB_BUILD_DIR));
} else {
  console.warn(`[web] build dir not found, skipping static: ${WEB_BUILD_DIR}`);
}

//
// ✅ 3. SAFE FALLBACK (NO "*")
// 
app.use((req, res) => {
  const indexHtml = path.join(WEB_BUILD_DIR, "index.html");
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  return res.status(404).json({ error: "not_found" });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
});
