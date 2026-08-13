/**
 * When a gpspos.net (cloud-polled) collar starts speaking TCP on our listener,
 * switch it to the live protocol so the app and poller follow the device —
 * no user or admin action required.
 */

const TCP_PROVIDERS = new Set(["gt06", "g365", "xexun"]);

function isCloudGpsposConfig(row) {
  if (!row) return false;
  const override = String(row.provider_override || "").trim().toLowerCase();
  const pollOn = Number(row.gpspos_poll_enabled) === 1;
  return override === "gpspos" || pollOn;
}

function alreadyPromotedTo(row, tcpProvider) {
  if (!row) return false;
  const override = String(row.provider_override || "").trim().toLowerCase();
  const pollOn = Number(row.gpspos_poll_enabled) === 1;
  return override === tcpProvider && !pollOn && Boolean(row.direct_tcp_switched_at);
}

/**
 * @param {object} store
 * @param {string} imei
 * @param {string} tcpProvider gt06 | g365 | xexun
 * @returns {{ switched: boolean, from?: string, to?: string, at?: string } | null}
 */
function promoteCloudDeviceToDirectTcp(store, imei, tcpProvider) {
  const k = String(imei || "").trim();
  const to = String(tcpProvider || "").trim().toLowerCase();
  if (!k || !TCP_PROVIDERS.has(to)) return null;
  if (typeof store?.updateDeviceConfig !== "function" || typeof store.getDeviceConfig !== "function") {
    return null;
  }

  const row = store.getDeviceConfig(k);
  if (!isCloudGpsposConfig(row)) return null;
  if (alreadyPromotedTo(row, to)) return null;

  const from = String(row.provider_override || "").trim().toLowerCase() || "gpspos";
  const at = new Date().toISOString();
  store.updateDeviceConfig(k, {
    provider_override: to,
    gpspos_poll_enabled: 0,
    direct_tcp_switched_at: at,
    direct_tcp_from_provider: from === to ? "gpspos" : from,
  });

  return { switched: true, from: from === to ? "gpspos" : from, to, at };
}

/** Env-listed gpspos IMEIs should stop polling after a TCP promote. */
function shouldSkipGpsposPoll(row) {
  if (!row) return false;
  if (row.direct_tcp_switched_at) return true;
  const override = String(row.provider_override || "").trim().toLowerCase();
  if (TCP_PROVIDERS.has(override)) return true;
  return false;
}

module.exports = {
  TCP_PROVIDERS,
  isCloudGpsposConfig,
  alreadyPromotedTo,
  promoteCloudDeviceToDirectTcp,
  shouldSkipGpsposPoll,
};
