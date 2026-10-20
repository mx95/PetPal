"use strict";

const { isPlausibleLatLng } = require("../geo/coords");
const { haversineM } = require("./geo");

const HOUR_MS = 3600 * 1000;

const DEFAULT_CONFIG = {
  /** Consecutive fixes on the other side of the boundary required before alerting. */
  confirmFixes: 2,
  /** Dead band outside the radius (max of this and 5% of the radius) to absorb GPS jitter. */
  zoneMarginMinM: 15,
  sosCooldownMs: 2 * 60 * 1000,
  batteryCooldownMs: 6 * HOUR_MS,
  batteryLowPct: 20,
  batteryResetPct: 30,
  offlineAfterMs: 3 * HOUR_MS,
  /** Only alert while the device went quiet recently, so restarts never re-alert ancient devices. */
  offlineWindowMs: 24 * HOUR_MS,
  /** Ignore fixes whose device timestamp is older than this relative to when we received them. */
  maxFixAgeMs: 30 * 60 * 1000,
};

const PREF_FLAG_BY_TYPE = {
  zone_exit: "zone",
  zone_enter: "zone",
  battery_low: "battery",
  sos: "sos",
  offline: "offline",
};

function toMs(iso) {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
}

/** Trusted GPS fix from an incoming record, or null (LBS/WiFi/lost-lock/stale fixes never drive zone alerts). */
function extractFix(data, nowMs, maxFixAgeMs) {
  if (!data || typeof data !== "object") return null;
  if (data.gpsLockLost === true || data.gpsValid === false || data.heldLastKnown === true) return null;
  const source = String(data.source || data.location?.source || "").toLowerCase();
  if (source === "lbs" || source === "wifi" || source === "cell") return null;

  const candidate = data.location && data.location.lat != null ? data.location : data.gps;
  if (!candidate) return null;
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (!isPlausibleLatLng(lat, lng)) return null;

  const fixMs = toMs(data.gps?.timestamp || data.deviceStatus?.timestamp);
  const receivedMs = toMs(data.receivedAt) ?? nowMs;
  if (fixMs != null && receivedMs - fixMs > maxFixAgeMs) return null;
  return { lat, lng, fixMs };
}

function isSosRecord(data) {
  if (!data || typeof data !== "object") return false;
  return (
    data.sosAlarm === true ||
    data.alarm === "sos" ||
    data.terminalAlarm === "sos" ||
    data.deviceStatus?.alarm === "sos" ||
    data.deviceStatus?.terminalInfo?.terminalAlarm === "sos"
  );
}

function pickBattery(device) {
  const value = Number(device?.battery);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
}

/**
 * Evaluates every tracker record against its owner's safe zone / alert settings and delivers
 * in-app notifications + web push through `gateway` (see firebaseGateway.js).
 * @param {{ gateway: object, now?: () => number, logger?: Pick<Console, "log"|"warn">, config?: Partial<typeof DEFAULT_CONFIG> }} deps
 */
function createAlertEngine({ gateway, now = Date.now, logger = console, config = {}, persistence = null }) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const states = new Map();
  const queues = new Map();
  let dirty = false;

  const PERSISTED_KEYS = ["zoneSig", "zoneState", "batteryKnown", "lowBattery", "offlineNotifiedMs"];

  function loadPersisted() {
    if (!persistence?.load) return {};
    try {
      const saved = persistence.load();
      return saved && typeof saved === "object" ? saved : {};
    } catch (err) {
      logger.warn(`[alerts] could not load saved state: ${err?.message || err}`);
      return {};
    }
  }
  const persisted = loadPersisted();

  /** Writes state to disk if anything changed (called on a timer and at shutdown). */
  function flush() {
    if (!dirty || !persistence?.save) return;
    dirty = false;
    const out = {};
    for (const [imei, st] of states) {
      const row = {};
      for (const key of PERSISTED_KEYS) row[key] = st[key];
      out[imei] = row;
    }
    try {
      persistence.save(out);
    } catch (err) {
      logger.warn(`[alerts] could not save state: ${err?.message || err}`);
    }
  }

  function stateFor(imei) {
    let st = states.get(imei);
    if (!st) {
      st = {
        zoneSig: null,
        zoneState: null,
        candidate: null,
        lastFixMs: null,
        batteryKnown: false,
        lowBattery: false,
        lastSeenMs: null,
        offlineNotifiedMs: null,
        cooldowns: new Map(),
        ...(persisted[imei] || {}),
      };
      st.candidate = null;
      states.set(imei, st);
    }
    return st;
  }

  function enqueue(imei, task) {
    const prev = queues.get(imei) || Promise.resolve();
    const next = prev.then(task).catch((err) => {
      logger.warn(`[alerts] ${imei}: ${err?.message || err}`);
    });
    queues.set(imei, next);
    next.finally(() => {
      if (queues.get(imei) === next) queues.delete(imei);
    });
    return next;
  }

  function coolingDown(st, type, windowMs) {
    const last = st.cooldowns.get(type);
    return last != null && now() - last < windowMs;
  }

  async function notify(ctx, st, type, { params = {}, cooldownMs = 0, lat = null, lng = null } = {}) {
    const flag = PREF_FLAG_BY_TYPE[type];
    if (ctx.prefs[flag] === false) return false;
    if (cooldownMs && coolingDown(st, type, cooldownMs)) return false;
    st.cooldowns.set(type, now());

    const payload = {
      type,
      imei: ctx.imei,
      petId: ctx.petId,
      petName: ctx.petName,
      params: { pet: ctx.petName, ...params },
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
    await gateway.addNotification(ctx.uid, payload);
    if (ctx.prefs.push !== false) {
      await gateway.sendPush(ctx.uid, payload);
    }
    logger.log(`[alerts] ${type} → ${ctx.uid} (${ctx.petName || ctx.petId}, imei ${ctx.imei})`);
    return true;
  }

  async function evaluateZone(ctx, st, fix) {
    const zone = ctx.zone;
    if (!zone || zone.enabled === false) {
      if (st.zoneSig != null || st.zoneState != null) dirty = true;
      st.zoneSig = null;
      st.zoneState = null;
      st.candidate = null;
      return;
    }
    const sig = `${zone.lat.toFixed(5)},${zone.lng.toFixed(5)},${zone.radiusM}`;
    if (st.zoneSig !== sig) {
      st.zoneSig = sig;
      st.zoneState = null;
      st.candidate = null;
      dirty = true;
    }
    if (fix.fixMs != null) {
      if (st.lastFixMs != null && fix.fixMs < st.lastFixMs) return;
      st.lastFixMs = fix.fixMs;
    }

    const distanceM = haversineM(fix, zone);
    const margin = Math.max(cfg.zoneMarginMinM, zone.radiusM * 0.05);
    let observed = null;
    if (distanceM <= zone.radiusM) observed = "inside";
    else if (distanceM > zone.radiusM + margin) observed = "outside";
    if (!observed) return;

    if (st.zoneState == null) {
      st.zoneState = observed;
      st.candidate = null;
      dirty = true;
      return;
    }
    if (observed === st.zoneState) {
      st.candidate = null;
      return;
    }
    st.candidate = st.candidate?.state === observed ? { state: observed, count: st.candidate.count + 1 } : { state: observed, count: 1 };
    if (st.candidate.count < cfg.confirmFixes) return;

    st.zoneState = observed;
    st.candidate = null;
    dirty = true;
    const exited = observed === "outside";
    if (exited && zone.notifyExit === false) return;
    if (!exited && zone.notifyEnter === false) return;
    await notify(ctx, st, exited ? "zone_exit" : "zone_enter", {
      params: { radius: zone.radiusM },
      lat: fix.lat,
      lng: fix.lng,
    });
  }

  async function evaluateBattery(ctx, st, device) {
    const battery = pickBattery(device);
    if (battery == null) return;
    const charging = device?.charging === true;
    if (charging || battery >= cfg.batteryResetPct) {
      if (!st.batteryKnown || st.lowBattery) dirty = true;
      st.batteryKnown = true;
      st.lowBattery = false;
      return;
    }
    if (battery > cfg.batteryLowPct) {
      if (!st.batteryKnown) dirty = true;
      st.batteryKnown = true;
      return;
    }
    if (!st.batteryKnown) {
      st.batteryKnown = true;
      st.lowBattery = true;
      dirty = true;
      return;
    }
    if (st.lowBattery) return;
    st.lowBattery = true;
    dirty = true;
    await notify(ctx, st, "battery_low", {
      params: { battery },
      cooldownMs: cfg.batteryCooldownMs,
    });
  }

  /**
   * @param {string} imei
   * @param {object} data incoming record passed to store.upsert
   * @param {object} [device] merged device record after the upsert
   */
  function onRecord(imei, data, device) {
    const key = String(imei || "").trim();
    if (!key) return Promise.resolve();
    const st = stateFor(key);
    st.lastSeenMs = now();
    if (st.offlineNotifiedMs != null) {
      st.offlineNotifiedMs = null;
      dirty = true;
    }

    const fix = extractFix(data, now(), cfg.maxFixAgeMs);
    const sos = isSosRecord(data);
    const hasBattery = pickBattery(device) != null;
    if (!fix && !sos && !hasBattery) return Promise.resolve();

    return enqueue(key, async () => {
      const ctx = await gateway.resolve(key);
      if (!ctx) return;
      if (sos) {
        await notify(ctx, st, "sos", {
          cooldownMs: cfg.sosCooldownMs,
          lat: fix?.lat ?? null,
          lng: fix?.lng ?? null,
        });
      }
      if (fix) await evaluateZone(ctx, st, fix);
      if (hasBattery) await evaluateBattery(ctx, st, device);
    });
  }

  /** Alert owners whose tracker has gone quiet. Call periodically with the current device list. */
  async function sweepOffline(devices) {
    const nowMs = now();
    for (const device of devices || []) {
      const imei = String(device?.imei || "").trim();
      if (!imei) continue;
      const st = stateFor(imei);
      const lastSeenMs = st.lastSeenMs ?? toMs(device.receivedAt) ?? toMs(device.lastUpdate);
      if (lastSeenMs == null) continue;
      const quietMs = nowMs - lastSeenMs;
      if (quietMs < cfg.offlineAfterMs || quietMs > cfg.offlineAfterMs + cfg.offlineWindowMs) continue;
      if (st.offlineNotifiedMs != null) continue;
      st.offlineNotifiedMs = nowMs;
      dirty = true;
      await enqueue(imei, async () => {
        const ctx = await gateway.resolve(imei);
        if (!ctx) return;
        await notify(ctx, st, "offline", { params: { hours: Math.max(1, Math.round(quietMs / HOUR_MS)) } });
      });
    }
  }

  return { onRecord, sweepOffline, flush, config: cfg, _states: states };
}

module.exports = { createAlertEngine, extractFix, isSosRecord, DEFAULT_CONFIG };
