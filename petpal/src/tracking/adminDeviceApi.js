import { resolveTrackerHttpBase } from './trackingWifiFeature';

function trackerBase() {
  const base = resolveTrackerHttpBase();
  if (base == null) return null;
  return base;
}

function adminToken() {
  const raw = process.env.REACT_APP_TRACKER_ADMIN_TOKEN;
  return raw != null && String(raw).trim() !== '' ? String(raw).trim() : null;
}

function adminHeaders() {
  const token = adminToken();
  if (!token) return null;
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-PetPal-Admin-Token': token,
  };
}

export function isTrackerAdminApiAvailable() {
  return trackerBase() != null && adminToken() != null;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function listAdminDevices() {
  const base = trackerBase();
  const headers = adminHeaders();
  if (base == null || !headers) {
    const err = new Error('Tracker admin API is not configured.');
    err.code = 'TRACKER_ADMIN_NOT_CONFIGURED';
    throw err;
  }
  const path = '/api/admin/devices';
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, { headers });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.code = data?.error || 'admin_list_failed';
    throw err;
  }
  return data;
}

export async function patchAdminDevice(imei, patch) {
  const base = trackerBase();
  const headers = adminHeaders();
  if (base == null || !headers) {
    const err = new Error('Tracker admin API is not configured.');
    err.code = 'TRACKER_ADMIN_NOT_CONFIGURED';
    throw err;
  }
  const path = `/api/admin/devices/${encodeURIComponent(String(imei).trim())}`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(patch) });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.code = data?.error || 'admin_patch_failed';
    throw err;
  }
  return data;
}

export async function deleteAdminDevice(imei) {
  const base = trackerBase();
  const headers = adminHeaders();
  if (base == null || !headers) {
    const err = new Error('Tracker admin API is not configured.');
    err.code = 'TRACKER_ADMIN_NOT_CONFIGURED';
    throw err;
  }
  const path = `/api/admin/devices/${encodeURIComponent(String(imei).trim())}`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, { method: 'DELETE', headers });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.code = data?.error || 'admin_delete_failed';
    throw err;
  }
  return data;
}

/** Poll interval presets (seconds) for GPSPOS cloud devices. */
export const GPSPOS_POLL_PRESETS = [
  { id: '30', seconds: 30 },
  { id: '60', seconds: 60 },
  { id: '120', seconds: 120 },
  { id: '300', seconds: 300 },
  { id: '600', seconds: 600 },
  { id: '1800', seconds: 1800 },
  { id: '3600', seconds: 3600 },
];

/** Protocol choices for admin registry (Xexun removed). */
export const PROTOCOL_OPTIONS = [
  { id: 'g365', value: 'g365', label: '365GPS (TCP 7878…)' },
  { id: 'gpspos', value: 'gpspos', label: 'GPSPOS (cloud poll)' },
];

export const PROVIDER_OPTIONS = [
  { id: 'auto', value: null, label: 'Auto (from last ingest)' },
  ...PROTOCOL_OPTIONS,
];
