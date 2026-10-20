"use strict";

const fs = require("fs");
const path = require("path");
const { createAlertEngine } = require("./alertEngine");
const { createFirebaseGateway } = require("./firebaseGateway");

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const FLUSH_INTERVAL_MS = 30 * 1000;

function fileStatePersistence(filePath) {
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (err) {
        if (err?.code === "ENOENT") return {};
        throw err;
      }
    },
    save(obj) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const tmp = `${filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, filePath);
    },
  };
}

/**
 * Wraps `store.upsert` so every tracker record is evaluated for safe-zone / battery / SOS alerts.
 * Never throws and never delays ingest; returns null when alerts are disabled.
 */
function startAlerts({ store, logger = console, gateway = null, env = process.env } = {}) {
  const flag = String(env.ALERTS_ENABLED ?? "1").trim().toLowerCase();
  if (flag === "0" || flag === "false") {
    logger.log("[alerts] ALERTS_ENABLED=0 — alerts disabled");
    return null;
  }

  const activeGateway = gateway || createFirebaseGateway({ logger });
  if (!activeGateway) return null;

  const statePath = env.ALERTS_STATE_PATH || path.join(path.dirname(env.SQLITE_PATH || "/var/lib/petpal/petpal.sqlite"), "alerts-state.json");
  const engine = createAlertEngine({ gateway: activeGateway, logger, persistence: fileStatePersistence(statePath) });

  const originalUpsert = store.upsert.bind(store);
  store.upsert = (imei, data) => {
    const result = originalUpsert(imei, data);
    try {
      const device = typeof store.get === "function" ? store.get(imei) : null;
      engine.onRecord(imei, data, device);
    } catch (err) {
      logger.warn(`[alerts] ${imei}: ${err?.message || err}`);
    }
    return result;
  };

  const sweepTimer = setInterval(() => {
    try {
      engine.sweepOffline(store.list()).catch((err) => logger.warn(`[alerts] sweep failed: ${err?.message || err}`));
    } catch (err) {
      logger.warn(`[alerts] sweep failed: ${err?.message || err}`);
    }
  }, SWEEP_INTERVAL_MS);
  const flushTimer = setInterval(() => engine.flush(), FLUSH_INTERVAL_MS);
  sweepTimer.unref();
  flushTimer.unref();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      engine.flush();
      process.kill(process.pid, signal);
    });
  }

  logger.log(`[alerts] Safe-zone & notification alerts enabled (state: ${statePath})`);
  return { engine, stop: () => { clearInterval(sweepTimer); clearInterval(flushTimer); engine.flush(); } };
}

module.exports = { startAlerts, fileStatePersistence };
