/**
 * HTTP routes for gpspos.net cloud API polling (JSONP AppJson.asp).
 */
const {
  createGpsposClientFromEnv,
  mapGpsposPositionToDeviceRecord,
  parseDeviceIdList,
  parseImeiMap,
  resolvePlatformImei,
  resolveStoreImei,
  shouldRecordPosition,
} = require("../protocol/gpspos");
const { buildPositionPayload } = require("./positionPayload");
const { logPrefix } = require("../logging/time");

function gpsposConfigFromEnv(env = process.env) {
  const enabled =
    String(env.GPSPOS_ENABLED ?? "0").trim() !== "0" &&
    String(env.GPSPOS_ENABLED ?? "0").trim().toLowerCase() !== "false";
  return {
    enabled,
    pollIntervalSec: Math.max(0, Number(env.GPSPOS_POLL_INTERVAL_SEC || 60) || 0),
    deviceIds: parseDeviceIdList(env.GPSPOS_DEVICE_IDS || env.GPSPOS_IMEIS || ""),
    imeiMap: parseImeiMap(env.GPSPOS_IMEI_MAP || ""),
    baseUrl: env.GPSPOS_API_URL || env.GPSPOS_BASE_URL || null,
  };
}

async function syncGpsposLastPosition(store, client, requestedImei, { imeiMap = {} } = {}) {
  const storeImei = String(requestedImei || "").trim();
  if (!storeImei) throw new Error("missing_imei");

  const platformImei = resolvePlatformImei(storeImei, imeiMap);
  const parsed = await client.getLastPosition(platformImei);
  const row = parsed.records[0];
  if (!row) {
    const err = new Error("no_position");
    err.code = "no_position";
    throw err;
  }

  const prev = store.get(storeImei);
  const candidate = mapGpsposPositionToDeviceRecord(row, { imei: storeImei });
  const mapped = mapGpsposPositionToDeviceRecord(row, {
    imei: storeImei,
    recordPosition: shouldRecordPosition(prev, candidate),
  });

  store.upsert(storeImei, mapped);
  const saved = store.get(storeImei);
  const payload = buildPositionPayload(storeImei, saved);
  return { imei: storeImei, platformImei, device: saved, position: payload };
}

async function syncGpsposHistory(store, client, requestedImei, { fromUnix, toUnix, imeiMap = {} } = {}) {
  const storeImei = String(requestedImei || "").trim();
  if (!storeImei) throw new Error("missing_imei");
  if (!Number.isFinite(fromUnix) || !Number.isFinite(toUnix)) {
    throw new Error("missing_time_range");
  }

  const platformImei = resolvePlatformImei(storeImei, imeiMap);
  const parsed = await client.getTrack(platformImei, Math.floor(fromUnix), Math.floor(toUnix));
  let imported = 0;

  for (const row of parsed.records) {
    const mapped = mapGpsposPositionToDeviceRecord(row, {
      imei: storeImei,
      recordPosition: true,
    });
    if (mapped.location) {
      store.upsert(storeImei, mapped);
      imported += 1;
    }
  }

  return { imei: storeImei, platformImei, imported, total: parsed.records.length };
}

function startGpsposPoller(store, client, config) {
  if (!client || !config.enabled) return null;
  const ids = config.deviceIds;
  if (!ids.length || !config.pollIntervalSec) return null;

  const tick = async () => {
    for (const imei of ids) {
      try {
        await syncGpsposLastPosition(store, client, imei, { imeiMap: config.imeiMap });
        console.log(`${logPrefix({ dir: "in", tag: "gpspos" })} polled ${imei}`);
      } catch (err) {
        console.warn(
          `${logPrefix({ dir: "in", tag: "gpspos" })} poll ${imei} failed: ${err.message || err}`
        );
      }
    }
  };

  tick();
  return setInterval(tick, config.pollIntervalSec * 1000);
}

/**
 * @param {import("express").Express} app
 * @param {ReturnType<import("../store/memory").createMemoryStore>} store
 * @param {{ client?: import("../protocol/gpspos").GpsposClient|null, config?: ReturnType<typeof gpsposConfigFromEnv> }} [opts]
 */
function registerGpsposHttpApi(app, store, opts = {}) {
  const config = opts.config || gpsposConfigFromEnv();
  const client = opts.client !== undefined ? opts.client : createGpsposClientFromEnv();

  app.get("/api/gpspos", (_req, res) => {
    res.json({
      service: "gpspos.net JSONP cloud API",
      documentation: "docs/GPSPOS_SETUP.md",
      enabled: config.enabled && Boolean(client),
      pollIntervalSec: config.pollIntervalSec,
      deviceIds: config.deviceIds,
      imeiMap: config.imeiMap,
      baseUrl: config.baseUrl,
      commands: [
        { method: "POST", path: "/api/gpspos/sync", body: "{ imei }" },
        {
          method: "POST",
          path: "/api/gpspos/sync/history",
          body: "{ imei, fromUnix, toUnix }",
        },
        { method: "GET", path: "/api/positions?deviceId={imei}", note: "Vendor-compatible latest position array" },
      ],
      env: {
        GPSPOS_ENABLED: "1",
        GPSPOS_API_URL: "https://www.gpspos.net/AppJson.asp",
        GPSPOS_USER: "platform account",
        GPSPOS_PASSWORD: "platform password",
        GPSPOS_DEVICE_IDS: "imei1,imei2",
        GPSPOS_IMEI_MAP: "fullImei:platformId (optional)",
        GPSPOS_POLL_INTERVAL_SEC: "60",
      },
    });
  });

  app.post("/api/gpspos/sync", async (req, res) => {
    if (!config.enabled || !client) {
      return res.status(503).json({
        error: "gpspos_disabled",
        hint: "Set GPSPOS_ENABLED=1 and GPSPOS_API_URL (+ GPSPOS_USER/PASSWORD if required)",
      });
    }
    const imei = String(req.body?.imei || req.body?.deviceId || req.query?.imei || "").trim();
    if (!imei) return res.status(400).json({ error: "missing_imei" });

    try {
      const result = await syncGpsposLastPosition(store, client, imei, { imeiMap: config.imeiMap });
      return res.json({ ok: true, ...result });
    } catch (err) {
      if (err.code === "no_position") return res.status(404).json({ error: "no_position" });
      console.warn(`${logPrefix({ dir: "in", tag: "gpspos" })} sync failed: ${err.message || err}`);
      return res.status(502).json({ error: "gpspos_sync_failed", message: err.message || String(err) });
    }
  });

  app.post("/api/gpspos/sync/history", async (req, res) => {
    if (!config.enabled || !client) {
      return res.status(503).json({ error: "gpspos_disabled" });
    }
    const imei = String(req.body?.imei || req.body?.deviceId || "").trim();
    const fromUnix = Number(req.body?.fromUnix ?? req.body?.from);
    const toUnix = Number(req.body?.toUnix ?? req.body?.to);
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    if (!Number.isFinite(fromUnix) || !Number.isFinite(toUnix)) {
      return res.status(400).json({ error: "missing_time_range", hint: "fromUnix and toUnix (UTC seconds)" });
    }

    try {
      const result = await syncGpsposHistory(store, client, imei, {
        fromUnix,
        toUnix,
        imeiMap: config.imeiMap,
      });
      return res.json({ ok: true, ...result });
    } catch (err) {
      return res.status(502).json({ error: "gpspos_history_failed", message: err.message || String(err) });
    }
  });

  app.get("/api/positions", (req, res) => {
    const imei = String(req.query.deviceId || req.query.imei || "").trim();
    if (!imei) return res.status(400).json({ error: "missing_deviceId" });
    const d = store.get(imei);
    if (!d) return res.status(404).json({ error: "not_found" });

    const payload = buildPositionPayload(imei, d);
    if (payload.error === "no_position") return res.status(404).json({ error: "no_position" });

    res.json([
      {
        deviceId: imei,
        latitude: payload.lat,
        longitude: payload.lng,
        speed: payload.speed ?? d.speed ?? null,
        deviceTime: d.gps?.timestamp || payload.lastUpdate || null,
        serverTime: payload.lastUpdate || payload.receivedAt || null,
        source: payload.source || null,
        battery: payload.battery ?? null,
        signal: payload.signal ?? null,
      },
    ]);
  });

  const poller = startGpsposPoller(store, client, config);
  if (poller) {
    console.log(
      `[gpspos] polling ${config.deviceIds.length} device(s) every ${config.pollIntervalSec}s`
    );
  } else if (config.enabled && client) {
    console.log("[gpspos] enabled — sync via POST /api/gpspos/sync or set GPSPOS_DEVICE_IDS + poll interval");
  }

  return { client, config, poller };
}

module.exports = {
  registerGpsposHttpApi,
  gpsposConfigFromEnv,
  syncGpsposLastPosition,
  syncGpsposHistory,
  startGpsposPoller,
  resolveStoreImei,
};
