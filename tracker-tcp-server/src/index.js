const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { createMemoryStore } = require("./store/memory");
const { createSqliteStore } = require("./store/sqliteStore");
const { ensureCanonicalDatabase, backupDatabaseIfStale } = require("./db/ensureTrackerDatabase");
const { createG365TcpServer } = require("./tcp/g365Handler");
const { createGt06TcpServer } = require("./tcp/gt06Handler");
const { registerG365HttpApi } = require("./http/g365ApiRoutes");
const { registerGpsposHttpApi } = require("./http/gpsposApiRoutes");
const { registerAdminDeviceRoutes } = require("./http/adminDeviceRoutes");
const { logPrefix } = require("./logging/time");
const { buildPositionPayload } = require("./http/positionPayload");
const { repairStaleLastFixFromHistory } = require("./geo/repairStaleLastFix");
const { inferDeviceProvider } = require("./deviceProvider");

function withProvider(d) {
  if (!d) return d;
  const provider = d.provider || inferDeviceProvider(d);
  return provider && d.provider !== provider ? { ...d, provider } : d;
}

const GPS365_TCP_PORT = Number(process.env.GPS365_TCP_PORT || 5003);
/** Optional dedicated GT06 port (default off — GT06 is demuxed on GPS365_TCP_PORT). */
const GT06_TCP_PORT = Number(process.env.GT06_TCP_PORT || 5004);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);
const GPS365_TCP_ENABLED =
  String(process.env.GPS365_TCP_ENABLED ?? "1").trim() !== "0" &&
  String(process.env.GPS365_TCP_ENABLED ?? "1").trim().toLowerCase() !== "false";
const GT06_TCP_ENABLED =
  String(process.env.GT06_TCP_ENABLED ?? "0").trim() !== "0" &&
  String(process.env.GT06_TCP_ENABLED ?? "0").trim().toLowerCase() !== "false";

/** Production path is set in ecosystem.config.cjs (/var/lib/petpal). Local dev default: */
const SERVER_ROOT = path.join(__dirname, "..");
const DEFAULT_SQLITE_PATH = path.join(SERVER_ROOT, "data", "petpal.sqlite");
const REQUESTED_SQLITE_PATH = process.env.SQLITE_PATH || DEFAULT_SQLITE_PATH;
const explicitPersistOff =
  String(process.env.PERSIST_TO_SQLITE || "1").trim() === "0" ||
  String(process.env.PERSIST_TO_SQLITE || "1").trim().toLowerCase() === "false";
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();

if (explicitPersistOff && NODE_ENV === "production") {
  console.error("[db] PERSIST_TO_SQLITE=0 is not allowed in production — GPS history would be lost on restart.");
  process.exit(1);
}

const PERSIST_TO_SQLITE = !explicitPersistOff;
let SQLITE_PATH = path.resolve(REQUESTED_SQLITE_PATH);

if (PERSIST_TO_SQLITE) {
  const ensured = ensureCanonicalDatabase(SERVER_ROOT, SQLITE_PATH);
  SQLITE_PATH = ensured.path;
  if (ensured.restoredFrom) {
    console.log(`[db] Restored ${ensured.positionCount} position rows from ${ensured.restoredFrom}`);
  }
  backupDatabaseIfStale(SQLITE_PATH);
}

const store = PERSIST_TO_SQLITE ? createSqliteStore({ dbPath: SQLITE_PATH }) : createMemoryStore();
if (PERSIST_TO_SQLITE) {
  console.log(`[db] SQLite enabled at ${store.sqlitePath}`);
  try {
    const { purgeFlippedLatitudePositions } = require("../scripts/purge-flipped-latitude-positions");
    const { deleted, byImei } = purgeFlippedLatitudePositions(store.sqlitePath);
    if (deleted > 0) {
      console.log(`[db] Purged ${deleted} sign-flipped latitude row(s):`, byImei);
    }
  } catch (err) {
    console.warn("[db] Flipped-latitude purge skipped:", err.message || err);
  }
  if (typeof store.countPositions === "function") {
    const n = store.countPositions();
    console.log(`[db] ${n} position rows on disk (persists across pm2 restart)`);
  }
} else {
  console.warn("[db] PERSIST_TO_SQLITE=0 — all GPS data is in RAM only and is LOST on pm2 restart");
}

try {
  const { promoteLiveCloudDevicesAlreadyOnTcp } = require("./directTcpPromote");
  const promoted = promoteLiveCloudDevicesAlreadyOnTcp(store);
  for (const row of promoted) {
    console.log(
      `[tracker] Auto-switched ${row.imei} from ${row.from} cloud poll → ${row.to} TCP (already live on listener)`
    );
  }
} catch (err) {
  console.warn("[tracker] Direct-TCP promote on boot skipped:", err.message || err);
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

if (GPS365_TCP_ENABLED) {
  createG365TcpServer({ port: GPS365_TCP_PORT, store });
} else {
  console.log("[365GPS] GPS365_TCP_ENABLED=0 — 365GPS/GT06 listener disabled");
}
if (GT06_TCP_ENABLED) {
  createGt06TcpServer({ port: GT06_TCP_PORT, store });
  console.log(`[GT06] Extra dedicated listener on TCP ${GT06_TCP_PORT} (optional; demux already on ${GPS365_TCP_PORT})`);
}
const GPSPOS_ENABLED =
  String(process.env.GPSPOS_ENABLED ?? "0").trim() !== "0" &&
  String(process.env.GPSPOS_ENABLED ?? "0").trim().toLowerCase() !== "false";

console.log(
  `[tracker] Device listeners: 365GPS+GT06 → TCP ${GPS365_TCP_ENABLED ? GPS365_TCP_PORT : "disabled"} (7878…0D0A, CRC-ITU→gt06) | gpspos cloud → ${GPSPOS_ENABLED ? "enabled" : "disabled"} | HTTP API → ${HTTP_PORT}`
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


registerG365HttpApi(app, store);
registerGpsposHttpApi(app, store);
registerAdminDeviceRoutes(app, store);

app.get("/api/admin/db-health", (req, res) => {
  const expected = String(process.env.TRACKER_ADMIN_TOKEN || "").trim();
  if (expected) {
    const got = String(
      req.headers["x-petpal-admin-token"] ||
        req.headers["x-petpal-admin"] ||
        (req.headers.authorization || "").replace(/^Bearer\s+/i, "")
    ).trim();
    if (got !== expected) return res.status(401).json({ error: "unauthorized" });
  }
  const positionCount =
    typeof store.countPositions === "function" ? store.countPositions() : null;
  res.json({
    persistEnabled: PERSIST_TO_SQLITE,
    sqlitePath: PERSIST_TO_SQLITE ? store.sqlitePath || SQLITE_PATH : null,
    positionCount,
    deviceCount: typeof store.list === "function" ? store.list().length : null,
  });
});

// -----------------------------------------------------------------------------
// App API (frontend-safe) — keep /devices & /position as legacy, but also expose
// the documented /api/app/* paths used by the PetPal UI.
// -----------------------------------------------------------------------------

app.get("/api/app/devices", (req, res) => {
  res.json(store.list().map((d) => withProvider(d)));
});

app.get("/api/app/devices/:imei", (req, res) => {
  const imei = String(req.params.imei || "").trim();
  const d = store.get(imei);
  if (!d) {
    return res.status(404).json({
      error: "not_found",
      hint: "Register this IMEI in Admin → Device registry, or wait for the collar to check in.",
    });
  }
  const out = withProvider(d);
  res.json({
    ...out,
    registered: true,
    hasPosition: Boolean(out?.location || out?.gps?.lat != null || out?.gps?.lng != null),
  });
});

app.get("/api/app/position", (req, res) => {
  const imei = String(req.query.deviceId || req.query.imei || "").trim();
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  let d = store.get(imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  d = withProvider(d);
  const healed = repairStaleLastFixFromHistory(store, d);
  d = withProvider(healed.device);
  const payload = buildPositionPayload(imei, d);
  if (payload.error === "no_position") return res.status(404).json({ error: "no_position" });
  if (healed.repaired) {
    payload.repairedFromHistory = true;
    payload.repairDistanceM = healed.from?.distanceM ?? null;
  }
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
  const clear = req.body?.clear === true || req.body?.action === "clear";
  if (!imei) return res.status(400).json({ error: "missing_deviceId" });
  if (clear) {
    if (typeof store.clearHomeLocation !== "function") {
      return res.status(501).json({ error: "home_location_not_supported" });
    }
    store.clearHomeLocation(imei);
    return res.json({ ok: true, imei, cleared: true, homeLat: null, homeLng: null });
  }
  const lat = req.body?.lat != null ? Number(req.body.lat) : Number.NaN;
  const lng = req.body?.lng != null ? Number(req.body.lng) : Number.NaN;
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

const GPSPOS_PLAN_POLL_SEC = {
  long_life: 600,
  balanced: 300,
  regular: 180,
  active: 60,
};

app.patch("/api/app/devices/:imei/gpspos-plan", (req, res) => {
  const imei = String(req.params.imei || "").trim();
  if (!/^\d{10,20}$/.test(imei)) {
    return res.status(400).json({ error: "invalid_imei" });
  }
  if (typeof store.updateDeviceConfig !== "function") {
    return res.status(501).json({ error: "sqlite_required" });
  }

  const body = req.body || {};
  const planId = String(body.planId || "").trim();
  let intervalSec = Number(body.gpsposPollIntervalSec ?? body.uploadSeconds);
  if (planId && GPSPOS_PLAN_POLL_SEC[planId] != null) {
    intervalSec = GPSPOS_PLAN_POLL_SEC[planId];
  }
  if (!Number.isFinite(intervalSec) || intervalSec < 15 || intervalSec > 86400) {
    return res.status(400).json({ error: "invalid_poll_interval", hint: "15–86400 seconds" });
  }

  store.updateDeviceConfig(imei, {
    provider_override: "gpspos",
    gpspos_poll_enabled: 1,
    gpspos_poll_interval_sec: Math.floor(intervalSec),
  });

  const device = store.get(imei);
  res.json({
    ok: true,
    imei,
    planId: planId || null,
    gpsposPollIntervalSec: Math.floor(intervalSec),
    device,
  });
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
  let d = store.get(imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  d = withProvider(d);
  const healed = repairStaleLastFixFromHistory(store, d);
  d = withProvider(healed.device);
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

/** Rewrite legacy http:// tracker API calls to same-origin (HTTPS mixed-content safety). */
const TRACKER_FETCH_SHIM = `<script id="petpal-tracker-fetch-shim">(function(){var h=String(window.location.hostname||"").toLowerCase();if(!window.isSecureContext||h!=="petpal.com.cy"&&h!=="www.petpal.com.cy")return;var legacy=["http://116.203.209.68:5002","http://127.0.0.1:5002"];var f=window.fetch;window.fetch=function(i,n){var u=typeof i==="string"?i:i&&i.url;if(typeof u!=="string")return f.call(this,i,n);for(var k=0;k<legacy.length;k++){var b=legacy[k];if(u.indexOf(b)===0){u=u.slice(b.length)||"/";break;}}if(u!==(typeof i==="string"?i:i.url)){i=typeof i==="string"?u:new Request(u,i);}return f.call(this,i,n);};})();</script>`;

function sendSpaIndex(_req, res) {
  try {
    let html = fs.readFileSync(WEB_INDEX_HTML, "utf8");
    if (!html.includes("petpal-tracker-fetch-shim")) {
      html = html.replace("</head>", `${TRACKER_FETCH_SHIM}</head>`);
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.type("html").send(html);
  } catch (err) {
    console.warn(`[web] Failed to read ${WEB_INDEX_HTML}: ${err.message || err}`);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(WEB_INDEX_HTML);
  }
}

if (fs.existsSync(WEB_INDEX_HTML)) {
  app.get(["/", "/index.html"], sendSpaIndex);
  app.use(
    express.static(WEB_BUILD_DIR, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          return;
        }
        if (filePath.includes(`${path.sep}static${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        if (/\.(?:webp|png|jpe?g|gif|svg|ico|woff2?)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=2592000");
        }
      },
    })
  );
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
    return sendSpaIndex(req, res);
  }
  return res.status(404).json({ error: "not_found" });
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
});
