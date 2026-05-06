const express = require("express");

/**
 * Tracker (protocol layer) routes.
 * These endpoints are used for device communication / configuration only.
 *
 * @param {ReturnType<import("../store/memory").createMemoryStore>} store
 */
function createTrackerRoutes(store) {
  const router = express.Router();

  function imeiFrom(req) {
    return String(req.body?.imei || req.query?.imei || "").trim();
  }

  function respondQueued(imei, command, res, extra = {}) {
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    if (!command || typeof command !== "string") return res.status(400).json({ error: "missing_command" });
    store.enqueueCommand(imei, command);
    return res.json({
      ok: true,
      imei,
      command,
      pending: store.pendingCommands(imei),
      note: "Sent on next TCP uplink (0x20) after ACK.",
      ...extra
    });
  }

  router.get("/", (_req, res) => {
    res.json({
      service: "tracker-tcp-server",
      group: "tracker",
      endpoints: [
        { method: "POST", path: "/commands/queue", body: "{ imei, command }" },
        { method: "POST", path: "/commands/ip-transfer", body: "{ imei, host, port? }" },
        { method: "POST", path: "/commands/ip/query", body: "{ imei }" },
        { method: "POST", path: "/commands/apn", body: "{ imei, apn }" },
        { method: "POST", path: "/commands/tracking", body: "{ imei, tk } OR seven params" },
        { method: "POST", path: "/commands/tracking/query", body: "{ imei }" },
        { method: "POST", path: "/commands/power-off", body: "{ imei }" },
        { method: "POST", path: "/commands/restart", body: "{ imei }" },
        { method: "POST", path: "/commands/message", body: "{ imei, text }" },
        { method: "POST", path: "/commands/timezone", body: "{ imei, tz }" },
        { method: "POST", path: "/commands/timezone/query", body: "{ imei }" },
        { method: "POST", path: "/commands/ble", body: "{ imei, bssid_list?, clear?, query? }" },
        { method: "POST", path: "/commands/wifi", body: "{ imei, bssid_list?, clear?, query? }" },
        { method: "GET", path: "/commands/pending/:imei" }
      ]
    });
  });

  router.post("/commands/queue", (req, res) => {
    const imei = imeiFrom(req);
    const command = String(req.body?.command || "").trim();
    return respondQueued(imei, command, res);
  });

  router.post("/commands/ip-transfer", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const host = String(req.body?.host || req.body?.ip || "").trim().replace(/^\/\//, "");
    const port = Number(req.body?.port ?? process.env.TCP_PORT ?? 5001);
    if (!imei || !host) {
      return res.status(400).json({ error: "missing_imei_or_host", hint: "JSON { imei, host, port? }" });
    }
    if (!Number.isFinite(port) || port < 1 || port > 65535) return res.status(400).json({ error: "invalid_port" });
    return respondQueued(imei, `ip=${host}:${port}`, res, { xexun: "IP transfer (server switch)" });
  });

  router.post("/commands/ip/query", (req, res) => respondQueued(imeiFrom(req), "ip=?", res, { xexun: "Query IP/domain setting" }));

  router.post("/commands/apn", (req, res) => {
    const imei = imeiFrom(req);
    const apn = String(req.body?.apn || "").trim();
    if (!apn) return res.status(400).json({ error: "missing_apn" });
    return respondQueued(imei, `APN=${apn}`, res, { xexun: "Set APN" });
  });

  router.post("/commands/tracking", (req, res) => {
    const imei = imeiFrom(req);
    let command;
    if (req.body?.tk != null && String(req.body.tk).trim() !== "") {
      const raw = String(req.body.tk).trim();
      command = raw.startsWith("tk=") ? raw : `tk=${raw}`;
    } else {
      const nums = [req.body?.p1, req.body?.p2, req.body?.p3, req.body?.p4, req.body?.p5, req.body?.p6, req.body?.p7];
      if (nums.some((x) => x === undefined || x === null || Number.isNaN(Number(x)))) {
        return res.status(400).json({
          error: "missing_tracking_params",
          hint: "Provide body.tk full string OR numeric p1..p7 per vendor PDF (mode, intervalSec, …)"
        });
      }
      command = `tk=${nums.map((x) => String(x).trim()).join(",")}`;
    }
    return respondQueued(imei, command, res, { xexun: "Tracking method and frequency" });
  });

  router.post("/commands/tracking/query", (req, res) => respondQueued(imeiFrom(req), "tk=?", res, { xexun: "Query tracking settings" }));
  router.post("/commands/power-off", (req, res) => respondQueued(imeiFrom(req), "of=1", res, { xexun: "Power off device (after receipt)" }));
  router.post("/commands/restart", (req, res) => respondQueued(imeiFrom(req), "rt=1", res, { xexun: "Restart device" }));

  router.post("/commands/message", (req, res) => {
    const imei = imeiFrom(req);
    const text = req.body?.text != null ? String(req.body.text) : "";
    if (!text.trim()) return res.status(400).json({ error: "missing_text" });
    return respondQueued(imei, `mg=${text}`, res, { xexun: "On-screen message" });
  });

  router.post("/commands/timezone", (req, res) => {
    const imei = imeiFrom(req);
    const tz = req.body?.tz;
    if (tz === undefined || tz === null || String(tz).trim() === "") return res.status(400).json({ error: "missing_tz" });
    return respondQueued(imei, `tz=${String(tz).trim()}`, res, { xexun: "Set timezone offset (hours)" });
  });

  router.post("/commands/timezone/query", (req, res) => respondQueued(imeiFrom(req), "tz=?", res, { xexun: "Query timezone" }));

  router.post("/commands/ble", (req, res) => {
    const imei = imeiFrom(req);
    if (req.body?.query) return respondQueued(imei, "ble=?", res, { xexun: "Query BLE beacon list" });
    if (req.body?.clear) return respondQueued(imei, "ble={}", res, { xexun: "Clear BLE beacon list" });
    const list = req.body?.bssid_list;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({
        error: "missing_bssid_list",
        hint: 'Use { bssid_list: ["aa:bb:…"] } or { clear: true } or { query: true }'
      });
    }
    return respondQueued(imei, `ble=${JSON.stringify({ bssid_list: list })}`, res, { xexun: "Set BLE beacon BSSIDs" });
  });

  router.post("/commands/wifi", (req, res) => {
    const imei = imeiFrom(req);
    if (req.body?.query) return respondQueued(imei, "wifi=?", res, { xexun: "Query WiFi hotspot list" });
    if (req.body?.clear) return respondQueued(imei, "wifi={}", res, { xexun: "Clear WiFi hotspot list" });
    const list = req.body?.bssid_list;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({
        error: "missing_bssid_list",
        hint: 'Use { bssid_list: ["aa:bb:…"] } or { clear: true } or { query: true }'
      });
    }
    return respondQueued(imei, `wifi=${JSON.stringify({ bssid_list: list })}`, res, { xexun: "Set WiFi tracking BSSIDs" });
  });

  router.get("/commands/pending/:imei", (req, res) => {
    const imei = String(req.params.imei || "").trim();
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    res.json({ imei, pending: store.pendingCommands(imei) });
  });

  return router;
}

module.exports = { createTrackerRoutes };

