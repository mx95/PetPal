const express = require("express");
const db = require("../db");

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function computeSecondsAgo(ts) {
  if (!ts) return null;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

function createAppRoutes() {
  const router = express.Router();

  router.get("/devices", async (_req, res) => {
    try {
      const rows = await all("SELECT * FROM devices ORDER BY last_update DESC");
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: "internal", message: e?.message || String(e) });
    }
  });

  router.get("/devices/:imei", async (req, res) => {
    try {
      const imei = String(req.params.imei || "").trim();
      if (!imei) return res.status(400).json({ error: "missing_imei" });
      const row = await get("SELECT * FROM devices WHERE imei = ?", [imei]);
      if (!row) return res.status(404).json({ error: "not_found" });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: "internal", message: e?.message || String(e) });
    }
  });

  router.get("/position", async (req, res) => {
    try {
      const deviceId = String(req.query.deviceId || req.query.imei || "").trim();
      if (!deviceId) return res.status(400).json({ error: "missing_deviceId" });

      const row = await get("SELECT * FROM devices WHERE imei = ?", [deviceId]);
      if (!row) return res.status(404).json({ error: "not_found" });

      const secondsAgo = computeSecondsAgo(row.last_update);
      const isOnline = typeof secondsAgo === "number" ? secondsAgo < 120 : null;
      const accuracy = row.source === "gps" ? "high" : "low";

      res.json({
        lat: row.last_lat,
        lng: row.last_lng,
        battery: row.battery,
        signal: row.signal,
        source: row.source,
        accuracy,
        lastUpdate: row.last_update,
        secondsAgo,
        isOnline
      });
    } catch (e) {
      res.status(500).json({ error: "internal", message: e?.message || String(e) });
    }
  });

  router.get("/history", async (req, res) => {
    try {
      const deviceId = String(req.query.deviceId || "").trim();
      if (!deviceId) return res.status(400).json({ error: "missing_deviceId" });
      const rows = await all(
        `
          SELECT * FROM positions
          WHERE imei = ?
          ORDER BY timestamp DESC
          LIMIT 100
        `,
        [deviceId]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: "internal", message: e?.message || String(e) });
    }
  });

  return router;
}

module.exports = { createAppRoutes };

