/**
 * Admin API — device provider override & GPSPOS poll settings (SQLite).
 * Protected by TRACKER_ADMIN_TOKEN header: X-PetPal-Admin-Token
 */
const { logPrefix } = require("../logging/time");
const { effectiveProvider, inferDeviceProvider } = require("../deviceProvider");

const VALID_PROVIDERS = new Set(["g365", "gpspos"]);

function requireTrackerAdmin(req, res, next) {
  const expected = String(process.env.TRACKER_ADMIN_TOKEN || "").trim();
  if (!expected) {
    return res.status(503).json({
      error: "admin_api_disabled",
      hint: "Set TRACKER_ADMIN_TOKEN on the tracker server and rebuild the admin UI.",
    });
  }
  const got = String(
    req.headers["x-petpal-admin-token"] ||
      req.headers["x-petpal-admin"] ||
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "")
  ).trim();
  if (got !== expected) return res.status(401).json({ error: "unauthorized" });
  next();
}

function normalizeProvider(value) {
  if (value == null || value === "" || value === "auto") return null;
  const p = String(value).trim().toLowerCase();
  if (!VALID_PROVIDERS.has(p)) return undefined;
  return p;
}

function normalizeEmnifyCard(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function deviceConfigPayload(row, live) {
  if (!row && !live) return null;
  const imei = String(row?.imei || live?.imei || "").trim();
  const observed = live?.provider ?? row?.provider ?? inferDeviceProvider(live || {});
  return {
    imei,
    name: live?.name ?? row?.name ?? null,
    observedProvider: observed,
    providerOverride: row?.provider_override ?? null,
    effectiveProvider: effectiveProvider(live || {}, row?.provider_override),
    gpsposPlatformImei: row?.gpspos_platform_imei ?? null,
    gpsposPollEnabled: Boolean(Number(row?.gpspos_poll_enabled)),
    gpsposPollIntervalSec:
      row?.gpspos_poll_interval_sec != null ? Number(row.gpspos_poll_interval_sec) : null,
    emnifyCard: row?.emnify_card ?? null,
    lastUpdate: live?.lastUpdate ?? row?.last_update ?? null,
    battery: live?.battery ?? row?.battery ?? null,
    signal: live?.signal ?? row?.signal ?? null,
  };
}

/**
 * @param {import("express").Express} app
 * @param {ReturnType<import("../store/sqliteStore").createSqliteStore>} store
 */
function registerAdminDeviceRoutes(app, store) {
  if (typeof store.getDeviceConfig !== "function") {
    console.warn("[admin] Device config API disabled — SQLite store required");
    return;
  }

  app.get("/api/admin/devices", requireTrackerAdmin, (req, res) => {
    const rows = store.listDeviceConfigs();
    const rowByImei = new Map(rows.map((row) => [String(row.imei), row]));
    const liveByImei = new Map(store.list().map((d) => [String(d.imei), d]));
    const allImeis = new Set([...rowByImei.keys(), ...liveByImei.keys()]);
    res.json({
      ok: true,
      devices: [...allImeis].map((imei) =>
        deviceConfigPayload(rowByImei.get(imei), liveByImei.get(imei))
      ),
      defaults: {
        gpsposPollIntervalSec: Number(process.env.GPSPOS_POLL_INTERVAL_SEC || 60) || 60,
      },
    });
  });

  app.get("/api/admin/devices/:imei", requireTrackerAdmin, (req, res) => {
    const imei = String(req.params.imei || "").trim();
    const row = store.getDeviceConfig(imei);
    const live = store.get(imei);
    if (!row && !live) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, device: deviceConfigPayload(row, live) });
  });

  app.patch("/api/admin/devices/:imei", requireTrackerAdmin, (req, res) => {
    const imei = String(req.params.imei || "").trim();
    if (!/^\d{10,20}$/.test(imei)) {
      return res.status(400).json({ error: "invalid_imei" });
    }

    const body = req.body || {};
    const patch = {};

    if ("providerOverride" in body || "provider_override" in body) {
      const p = normalizeProvider(body.providerOverride ?? body.provider_override);
      if (p === undefined) {
        return res.status(400).json({ error: "invalid_provider", allowed: [...VALID_PROVIDERS, "auto"] });
      }
      patch.provider_override = p;
    }

    if ("gpsposPlatformImei" in body || "gpspos_platform_imei" in body) {
      const v = body.gpsposPlatformImei ?? body.gpspos_platform_imei;
      patch.gpspos_platform_imei = v == null || String(v).trim() === "" ? null : String(v).trim();
    }

    if ("gpsposPollEnabled" in body || "gpspos_poll_enabled" in body) {
      patch.gpspos_poll_enabled = body.gpsposPollEnabled ?? body.gpspos_poll_enabled ? 1 : 0;
    }

    if ("gpsposPollIntervalSec" in body || "gpspos_poll_interval_sec" in body) {
      const n = Number(body.gpsposPollIntervalSec ?? body.gpspos_poll_interval_sec);
      if (!Number.isFinite(n) || n < 15 || n > 86400) {
        return res.status(400).json({ error: "invalid_poll_interval", hint: "15–86400 seconds" });
      }
      patch.gpspos_poll_interval_sec = Math.floor(n);
    }

    if ("emnifyCard" in body || "emnify_card" in body) {
      patch.emnify_card = normalizeEmnifyCard(body.emnifyCard ?? body.emnify_card);
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: "empty_patch" });
    }

    store.updateDeviceConfig(imei, patch);
    const row = store.getDeviceConfig(imei);
    const live = store.get(imei);
    console.log(`${logPrefix({ dir: "in", tag: "admin" })} device config ${imei}`, patch);
    res.json({ ok: true, device: deviceConfigPayload(row, live) });
  });

  app.delete("/api/admin/devices/:imei", requireTrackerAdmin, (req, res) => {
    const imei = String(req.params.imei || "").trim();
    if (!/^\d{10,20}$/.test(imei)) {
      return res.status(400).json({ error: "invalid_imei" });
    }
    if (typeof store.deleteDevice !== "function") {
      return res.status(503).json({ error: "delete_unsupported" });
    }
    const existed = store.deleteDevice(imei);
    if (!existed) return res.status(404).json({ error: "not_found" });
    console.log(`${logPrefix({ dir: "in", tag: "admin" })} device deleted ${imei}`);
    res.json({ ok: true, imei, deleted: true });
  });

  app.delete("/api/admin/devices/:imei/positions", requireTrackerAdmin, (req, res) => {
    const imei = String(req.params.imei || "").trim();
    if (!/^\d{10,20}$/.test(imei)) {
      return res.status(400).json({ error: "invalid_imei" });
    }
    if (typeof store.clearDevicePositions !== "function") {
      return res.status(503).json({ error: "clear_unsupported" });
    }
    const row = store.getDeviceConfig(imei);
    const live = store.get(imei);
    if (!row && !live) return res.status(404).json({ error: "not_found" });
    const deleted = store.clearDevicePositions(imei);
    console.log(`${logPrefix({ dir: "in", tag: "admin" })} cleared positions ${imei} (${deleted})`);
    res.json({ ok: true, imei, deleted });
  });

  app.get("/api/admin", requireTrackerAdmin, (_req, res) => {
    res.json({
      service: "PetPal tracker admin",
      endpoints: [
        { method: "GET", path: "/api/admin/devices" },
        { method: "GET", path: "/api/admin/devices/:imei" },
        {
          method: "PATCH",
          path: "/api/admin/devices/:imei",
          body: "providerOverride, gpsposPlatformImei, gpsposPollEnabled, gpsposPollIntervalSec, emnifyCard",
        },
        { method: "DELETE", path: "/api/admin/devices/:imei" },
        { method: "DELETE", path: "/api/admin/devices/:imei/positions" },
      ],
      auth: "Header X-PetPal-Admin-Token: TRACKER_ADMIN_TOKEN",
    });
  });
}

module.exports = { registerAdminDeviceRoutes, requireTrackerAdmin };
