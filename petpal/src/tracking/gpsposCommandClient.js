import { resolveTrackerHttpBase } from './trackingWifiFeature';

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Pull latest fix from gpspos cloud API via tracker-tcp-server.
 * @param {string} imei
 */
export async function syncGpsposPosition(imei) {
  const base = resolveTrackerHttpBase();
  if (!base) {
    const err = new Error('Tracker API not configured');
    err.code = 'TRACKER_API_NOT_CONFIGURED';
    throw err;
  }
  const path = '/api/gpspos/sync';
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ imei: String(imei || '').trim() }),
  });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Sync returned ${res.status}`);
    err.code = data?.error || 'gpspos_sync_failed';
    err.status = res.status;
    throw err;
  }
  return data;
}

export function isGpsposSyncAvailable() {
  return Boolean(resolveTrackerHttpBase());
}

/**
 * Save GPSPOS poll cadence from a battery plan (maps to cloud pull interval on the tracker server).
 * @param {string} imei
 * @param {{ planId?: string, gpsposPollIntervalSec?: number }} opts
 */
export async function saveGpsposBatteryPlan(imei, opts = {}) {
  const base = resolveTrackerHttpBase();
  if (!base) {
    const err = new Error('Tracker API not configured');
    err.code = 'TRACKER_API_NOT_CONFIGURED';
    throw err;
  }
  const path = `/api/app/devices/${encodeURIComponent(String(imei || '').trim())}/gpspos-plan`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Plan save returned ${res.status}`);
    err.code = data?.error || 'gpspos_plan_failed';
    err.status = res.status;
    throw err;
  }
  return data;
}
