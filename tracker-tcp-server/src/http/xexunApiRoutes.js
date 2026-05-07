/**
 * HTTP wrappers for Xexun 0x21 command strings (vendor API PDF).
 * All commands are queued and sent after ACK on the next device uplink (0x20).
 */

function imeiFrom(req) {
  return String(req.body?.imei || req.query?.imei || "").trim();
}

function respondQueued(store, imei, command, res, extra = {}) {
  if (!imei) {
    return res.status(400).json({ error: "missing_imei" });
  }
  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "missing_command" });
  }
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

/**
 * @param {import("express").Express} app
 * @param {ReturnType<import("../store/memory").createMemoryStore>} store
 */
function registerXexunHttpApi(app, store) {
  /** Discovery — lists every HTTP route this service exposes */
  app.get("/", (_req, res) => {
    res.json({
      service: "tracker-tcp-server",
      docs: "Xexun binary protocol command text → queued 0x21 frames",
      endpoints: [
        { method: "GET", path: "/", description: "This discovery JSON" },
        { method: "GET", path: "/devices", description: "All devices last seen" },
        { method: "GET", path: "/devices/:imei", description: "One device snapshot" },
        { method: "GET", path: "/devices/:imei/status", description: "Status-only snapshot" },
        { method: "GET", path: "/position", query: "deviceId or imei", description: "Latest lat/lng for maps" },
        { method: "POST", path: "/commands/queue", body: "{ imei, command }", description: "Raw 0x21 text (any vendor command)" },
        { method: "POST", path: "/commands/ip-transfer", body: "{ imei, host, port? }", description: "ip=host:port server switch" },
        { method: "POST", path: "/commands/ip/query", body: "{ imei }", description: "ip=? query current IP target" },
        { method: "POST", path: "/commands/apn", body: "{ imei, apn }", description: "APN=name" },
        { method: "POST", path: "/commands/tracking", body: "{ imei, tk } OR seven params", description: "tk=… tracking schedule" },
        { method: "POST", path: "/commands/tracking/query", body: "{ imei }", description: "tk=? query" },
        { method: "POST", path: "/commands/power-off", body: "{ imei }", description: "of=1 shutdown" },
        { method: "POST", path: "/commands/restart", body: "{ imei }", description: "rt=1 reboot" },
        { method: "POST", path: "/commands/message", body: "{ imei, text }", description: "mg=… screen message" },
        { method: "POST", path: "/commands/timezone", body: "{ imei, tz }", description: "tz=N (-12..12)" },
        { method: "POST", path: "/commands/timezone/query", body: "{ imei }", description: "tz=? query" },
        { method: "POST", path: "/commands/ble", body: "{ imei, bssid_list?, clear?, query? }", description: "BLE beacon list / clear / query" },
        { method: "POST", path: "/commands/wifi", body: "{ imei, bssid_list?, clear?, query? }", description: "WiFi BSSID list / clear / query" },
        { method: "GET", path: "/commands/pending/:imei", description: "Queued commands for IMEI" }
      ]
    });
  });

  app.post("/commands/queue", (req, res) => {
    const imei = imeiFrom(req);
    const command = String(req.body?.command || "").trim();
    return respondQueued(store, imei, command, res);
  });

  app.post("/commands/ip-transfer", (req, res) => {
    const imei = String(req.body?.imei || "").trim();
    const host = String(req.body?.host || req.body?.ip || "")
      .trim()
      .replace(/^\/\//, "");
    const port = Number(req.body?.port ?? process.env.TCP_PORT ?? 5001);
    if (!imei || !host) {
      return res.status(400).json({ error: "missing_imei_or_host", hint: "JSON { imei, host, port? }" });
    }
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return res.status(400).json({ error: "invalid_port" });
    }
    const command = `ip=${host}:${port}`;
    return respondQueued(store, imei, command, res, { xexun: "IP transfer (server switch)" });
  });

  app.post("/commands/ip/query", (req, res) => {
    const imei = imeiFrom(req);
    return respondQueued(store, imei, "ip=?", res, { xexun: "Query IP/domain setting" });
  });

  /** Cellular APN — doc: APN=Internet */
  app.post("/commands/apn", (req, res) => {
    const imei = imeiFrom(req);
    const apn = String(req.body?.apn || "").trim();
    if (!apn) return res.status(400).json({ error: "missing_apn" });
    const command = `APN=${apn}`;
    return respondQueued(store, imei, command, res, { xexun: "Set APN" });
  });

  /**
   * Tracking mode & intervals — doc: tk=2,60,2,3600,0,0,20 style (seven comma-separated fields).
   * Pass either body.tk as full string (after tk=) or p1..p7 numbers.
   */
  app.post("/commands/tracking", (req, res) => {
    const imei = imeiFrom(req);
    let command;
    if (req.body?.tk != null && String(req.body.tk).trim() !== "") {
      const raw = String(req.body.tk).trim();
      command = raw.startsWith("tk=") ? raw : `tk=${raw}`;
    } else {
      const nums = [
        req.body?.p1,
        req.body?.p2,
        req.body?.p3,
        req.body?.p4,
        req.body?.p5,
        req.body?.p6,
        req.body?.p7
      ];
      if (nums.some((x) => x === undefined || x === null || Number.isNaN(Number(x)))) {
        return res.status(400).json({
          error: "missing_tracking_params",
          hint: 'Provide body.tk full string OR numeric p1..p7 per vendor PDF (mode, intervalSec, …)'
        });
      }
      command = `tk=${nums.map((x) => String(x).trim()).join(",")}`;
    }
    return respondQueued(store, imei, command, res, { xexun: "Tracking method and frequency" });
  });

  app.post("/commands/tracking/query", (req, res) => {
    const imei = imeiFrom(req);
    return respondQueued(store, imei, "tk=?", res, { xexun: "Query tracking settings" });
  });

  app.post("/commands/power-off", (req, res) => {
    const imei = imeiFrom(req);
    return respondQueued(store, imei, "of=1", res, { xexun: "Power off device (after receipt)" });
  });

  app.post("/commands/restart", (req, res) => {
    const imei = imeiFrom(req);
    return respondQueued(store, imei, "rt=1", res, { xexun: "Restart device" });
  });

  /** mg=TEXT — devices with screens */
  app.post("/commands/message", (req, res) => {
    const imei = imeiFrom(req);
    const text = req.body?.text != null ? String(req.body.text) : "";
    if (!text.trim()) return res.status(400).json({ error: "missing_text" });
    const command = `mg=${text}`;
    return respondQueued(store, imei, command, res, { xexun: "On-screen message" });
  });

  /** tz — hour offset -12 .. +12 */
  app.post("/commands/timezone", (req, res) => {
    const imei = imeiFrom(req);
    const tz = req.body?.tz;
    if (tz === undefined || tz === null || String(tz).trim() === "") {
      return res.status(400).json({ error: "missing_tz" });
    }
    const command = `tz=${String(tz).trim()}`;
    return respondQueued(store, imei, command, res, { xexun: "Set timezone offset (hours)" });
  });

  app.post("/commands/timezone/query", (req, res) => {
    const imei = imeiFrom(req);
    return respondQueued(store, imei, "tz=?", res, { xexun: "Query timezone" });
  });

  /** BLE beacon MAC list — JSON per vendor */
  app.post("/commands/ble", (req, res) => {
    const imei = imeiFrom(req);
    if (req.body?.query) {
      return respondQueued(store, imei, "ble=?", res, { xexun: "Query BLE beacon list" });
    }
    if (req.body?.clear) {
      return respondQueued(store, imei, "ble={}", res, { xexun: "Clear BLE beacon list" });
    }
    const list = req.body?.bssid_list;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: "missing_bssid_list", hint: 'Use { bssid_list: ["aa:bb:…"] } or { clear: true } or { query: true }' });
    }
    const payload = JSON.stringify({ bssid_list: list });
    const command = `ble=${payload}`;
    return respondQueued(store, imei, command, res, { xexun: "Set BLE beacon BSSIDs" });
  });

  /** WiFi hotspot BSSIDs — JSON per vendor */
  app.post("/commands/wifi", (req, res) => {
    const imei = imeiFrom(req);
    if (req.body?.query) {
      return respondQueued(store, imei, "wifi=?", res, { xexun: "Query WiFi hotspot list" });
    }
    if (req.body?.clear) {
      return respondQueued(store, imei, "wifi={}", res, { xexun: "Clear WiFi hotspot list" });
    }
    const list = req.body?.bssid_list;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(400).json({ error: "missing_bssid_list", hint: 'Use { bssid_list: ["aa:bb:…"] } or { clear: true } or { query: true }' });
    }
    const payload = JSON.stringify({ bssid_list: list });
    const command = `wifi=${payload}`;
    return respondQueued(store, imei, command, res, { xexun: "Set WiFi tracking BSSIDs" });
  });

  app.get("/commands/pending/:imei", (req, res) => {
    const imei = String(req.params.imei || "").trim();
    if (!imei) return res.status(400).json({ error: "missing_imei" });
    res.json({ imei, pending: store.pendingCommands(imei) });
  });
}

module.exports = { registerXexunHttpApi };
