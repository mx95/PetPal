import { getTrackingModePreset, getXexunBatteryPlan, presetToTkBody } from './trackingModePresets';
import { resolveTrackerHttpBase } from './trackingWifiFeature';

function trackerApiBase() {
  return resolveTrackerHttpBase();
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** @returns {boolean} */
export function isTrackerCommandsAvailable() {
  return trackerApiBase() != null;
}

/**
 * @param {string} path e.g. `/api/tracker/commands/wifi`
 * @param {Record<string, unknown>} body
 */
export async function postTrackerCommand(path, body) {
  const base = trackerApiBase();
  if (base == null) {
    const err = new Error('TRACKER_API_NOT_CONFIGURED');
    err.code = 'TRACKER_API_NOT_CONFIGURED';
    throw err;
  }
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const code = data?.error ? String(data.error) : '';
    const err = new Error(code ? `Tracker API ${res.status} (${code})` : `Tracker API ${res.status}`);
    err.status = res.status;
    err.code = code || 'tracker_api_error';
    throw err;
  }
  return data;
}

/** @param {string} imei @param {string} presetId */
export async function applyTrackingModePreset(imei, presetId) {
  const preset = getTrackingModePreset(presetId);
  if (!preset) throw new Error('invalid_preset');
  return postTrackerCommand('/api/tracker/commands/tracking', {
    imei: String(imei).trim(),
    ...presetToTkBody(preset),
  });
}

/** @param {string} imei @param {string} planId long_life|balanced|regular|active */
export async function applyXexunBatteryPlan(imei, planId) {
  const plan = getXexunBatteryPlan(planId);
  if (!plan) throw new Error('invalid_preset');
  return postTrackerCommand('/api/tracker/commands/tracking', {
    imei: String(imei).trim(),
    ...plan,
  });
}

/** @param {string} imei @param {string[]} bssidList */
export async function applyWifiBssids(imei, bssidList) {
  const list = bssidList.map(normalizeBssid).filter(Boolean);
  if (!list.length) throw new Error('missing_bssid_list');
  return postTrackerCommand('/api/tracker/commands/wifi', {
    imei: String(imei).trim(),
    bssid_list: list,
  });
}

/** @param {string} imei */
export async function queryWifiBssids(imei) {
  return postTrackerCommand('/api/tracker/commands/wifi', {
    imei: String(imei).trim(),
    query: true,
  });
}

/** @param {string} imei */
export async function queryTrackingMode(imei) {
  return postTrackerCommand('/api/tracker/commands/tracking/query', {
    imei: String(imei).trim(),
  });
}

/** @param {string} imei */
export async function fetchPendingCommands(imei) {
  const base = trackerApiBase();
  if (base == null) return { pending: [] };
  const path = `/api/tracker/commands/pending/${encodeURIComponent(String(imei).trim())}`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await readJsonSafe(res);
  if (!res.ok) return { pending: [], error: data?.error };
  return data;
}

/** @param {string} raw @returns {string} aa:bb:cc:dd:ee:ff while typing */
export function formatBssidInput(raw) {
  const hex = String(raw || '')
    .replace(/[^0-9a-fA-F]/g, '')
    .slice(0, 12);
  const parts = hex.match(/.{1,2}/g) || [];
  return parts.join(':');
}

/** @param {string} raw @returns {string|null} normalized aa:bb:cc:dd:ee:ff */
export function normalizeBssid(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, ':');
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(s)) return null;
  return s;
}

/** Same router family (sticker MAC vs Wi‑Fi BSSID often differ in 1st/last byte). */
export function bssidSameRouterFamily(a, b) {
  const na = normalizeBssid(a);
  const nb = normalizeBssid(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = na.split(':');
  const pb = nb.split(':');
  return pa.slice(1, 5).join(':') === pb.slice(1, 5).join(':');
}

/** @param {string} userBssid @param {string[]} scanned */
export function pickBestScannedBssid(userBssid, scanned) {
  const list = (scanned || []).map(normalizeBssid).filter(Boolean);
  if (!list.length) return null;
  const user = normalizeBssid(userBssid);
  if (user && list.includes(user)) return user;
  if (user) {
    const family = list.find((s) => bssidSameRouterFamily(user, s));
    if (family) return family;
  }
  return list[0];
}
