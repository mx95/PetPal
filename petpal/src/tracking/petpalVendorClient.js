/**
 * PetPal vendor-shaped position API.
 *
 * Supports:
 * - Optional PetPal BFF proxy (recommended for production)
 * - Direct Xexun tracker HTTP API (`tracker-tcp-server`)
 * - Optional third-party vendor API that speaks a common GPS-platform REST shape
 */

function bffBase() {
  const raw = process.env.REACT_APP_TRACKING_BFF_URL;
  if (raw == null || raw === '') return null;
  if (raw === 'same') return '';
  return String(raw).replace(/\/$/, '');
}

function vendorBase() {
  const raw = process.env.REACT_APP_PETPAL_VENDOR_BASE_URL;
  if (raw == null || raw === '') return null;
  if (raw === 'same') return '';
  return String(raw).replace(/\/$/, '');
}

function xexunBase() {
  const raw = process.env.REACT_APP_XEXUN_HTTP_BASE_URL;
  if (raw == null || raw === '') return null;
  if (raw === 'same') return '';
  return String(raw).replace(/\/$/, '');
}

/** @returns {'bff' | 'petpal' | 'xexun' | 'mock'} */
export function getTrackingDataSource() {
  if (bffBase() != null) return 'bff';
  if (vendorBase() !== null) return 'petpal';
  if (xexunBase() !== null) return 'xexun';
  return 'mock';
}

function authHeaders() {
  const user = process.env.REACT_APP_PETPAL_VENDOR_USER;
  const pass = process.env.REACT_APP_PETPAL_VENDOR_PASS;
  if (!user) return {};
  return {
    Authorization: `Basic ${btoa(`${user}:${pass || ''}`)}`,
  };
}

function timeValue(p) {
  const t = p.serverTime || p.deviceTime || p.fixTime || p.lastUpdate;
  if (!t) return 0;
  return new Date(t).getTime();
}

function pickLatest(positions) {
  if (!Array.isArray(positions) || positions.length === 0) return null;
  return positions.reduce((a, b) => (timeValue(b) > timeValue(a) ? b : a));
}

export function normalizeVendorPosition(p) {
  if (!p) return null;
  const lat = typeof p.latitude === 'number' ? p.latitude : Number(p.latitude ?? p.lat);
  const lng = typeof p.longitude === 'number' ? p.longitude : Number(p.longitude ?? p.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    speed: p.speed != null ? Number(p.speed) : null,
    address: p.address || null,
    deviceTime: p.deviceTime || null,
    serverTime: p.serverTime || p.lastUpdate || null,
    source: 'petpal',
  };
}

function normalizeHistoryPoint(p, idx = 0) {
  const lat = typeof p?.latitude === 'number' ? p.latitude : Number(p?.latitude ?? p?.lat);
  const lng = typeof p?.longitude === 'number' ? p.longitude : Number(p?.longitude ?? p?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const timestamp = p.timestamp || p.deviceTimeUtc || p.deviceTime || p.serverTime || p.lastUpdate || new Date(Date.now() - idx * 900_000).toISOString();
  return {
    id: p.id || `${timestamp}-${idx}`,
    lat,
    lng,
    speed: p.speed != null ? Number(p.speed) : null,
    battery: p.battery ?? null,
    signal: p.signal ?? null,
    source: p.source || 'history',
    timestamp,
    address: p.address || null,
  };
}

function bffAuthHeaders() {
  const t = process.env.REACT_APP_TRACKING_BFF_TOKEN;
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

function normalizeBffPosition(json) {
  if (!json) return null;
  const lat =
    json.lat != null
      ? Number(json.lat)
      : json.latitude != null
        ? Number(json.latitude)
        : Number.NaN;
  const lng =
    json.lng != null
      ? Number(json.lng)
      : json.longitude != null
        ? Number(json.longitude)
        : Number.NaN;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    speed: json.speed != null ? Number(json.speed) : null,
    address: json.address || null,
    deviceTime: json.deviceTime || null,
    serverTime: json.serverTime || json.lastUpdate || null,
    source: 'bff',
  };
}

function normalizeXexunPosition(json) {
  if (!json) return null;
  const lat =
    json.lat != null
      ? Number(json.lat)
      : json.latitude != null
        ? Number(json.latitude)
        : Number.NaN;
  const lng =
    json.lng != null
      ? Number(json.lng)
      : json.longitude != null
        ? Number(json.longitude)
        : Number.NaN;
  const diagnostics = {
    received: json.received ?? null,
    raw: json.raw ?? null,
  };
  const hasCoordinates = !Number.isNaN(lat) && !Number.isNaN(lng);
  if (!hasCoordinates && !diagnostics.received && !diagnostics.raw) return null;
  const deviceTime = json.deviceTimeUtc || json.deviceTime || null;
  const serverTime = json.lastUpdateServer || json.serverTime || json.lastUpdate || null;
  return {
    lat: hasCoordinates ? lat : null,
    lng: hasCoordinates ? lng : null,
    speed: json.speed != null ? Number(json.speed) : null,
    address: json.address || null,
    deviceTime,
    serverTime,
    source: json.source || 'xexun',
    accuracy: json.accuracy || null,
    warningApproximate: Boolean(json.warningApproximate),
    isStale: json.isStale ?? null,
    secondsAgo: json.secondsAgo ?? null,
    deviceTimeLocal: json.deviceTimeLocal || null,
    freshness: json.freshness || null,
    statusText: json.statusText || null,
    accuracyText: json.accuracyText || null,
    movementText: json.movementText || null,
    battery: json.battery ?? null,
    batteryStatus: json.batteryStatus ?? null,
    signal: json.signal ?? null,
    signalStatus: json.signalStatus ?? null,
    isCharging: json.isCharging ?? null,
    steps: json.steps ?? null,
    isMoving: json.isMoving ?? null,
    warningStale: json.warningStale ?? null,
    diagnostics,
  };
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function fetchBffPosition(deviceId) {
  const base = bffBase();
  const path = `/position?deviceId=${encodeURIComponent(deviceId)}`;
  const url = base === '' ? path : `${base}${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...bffAuthHeaders() },
    credentials: 'include',
  });

  const data = await readJsonSafe(res);

  if (!res.ok) {
    const code = data?.error;
    if (res.status === 400 && (code === 'missing_deviceId' || code === 'missing_imei')) {
      throw new Error('Missing device ID — enter the IMEI in the field or save it on My pets.');
    }
    if (res.status === 404 && code === 'no_position') {
      throw new Error('No GPS coordinates on server yet. Wait for the device to send a location fix.');
    }
    if (res.status === 404 && code === 'not_found') {
      throw new Error('This device ID has not checked in yet — verify it and that the tracker connects to your ingest.');
    }
    const err = new Error(code ? `Backend (BFF) ${res.status} (${code})` : `Backend (BFF) returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const normalized = normalizeBffPosition(data);
  if (!normalized) throw new Error('BFF response did not include usable lat/lng.');
  return normalized;
}

async function fetchXexunPosition(deviceId) {
  const base = xexunBase();
  const path = `/position?deviceId=${encodeURIComponent(deviceId)}`;
  const url = base === '' ? path : `${base}${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });

  const data = await readJsonSafe(res);

  if (!res.ok) {
    const code = data?.error;
    if (res.status === 400 && (code === 'missing_deviceId' || code === 'missing_imei')) {
      throw new Error('Missing IMEI — type the 15-digit IMEI above or set it under My pets.');
    }
    if (res.status === 404 && code === 'no_position') {
      const device = await fetchXexunDevice(deviceId);
      if (device) return device;
      throw new Error('No GPS fix stored yet. Wait for coordinates from the device.');
    }
    if (res.status === 404 && code === 'not_found') {
      throw new Error('IMEI not seen on tracker server yet. Check the ID matches the device and that it connects to your TCP port.');
    }
    const err = new Error(code ? `Tracker HTTP API ${res.status} (${code})` : `Tracker HTTP API returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const normalized = normalizeXexunPosition(data);
  if (!normalized) throw new Error('Tracker response had no usable lat/lng (empty or invalid JSON).');
  return normalized;
}

async function fetchXexunDevice(deviceId) {
  const base = xexunBase();
  const path = `/devices/${encodeURIComponent(deviceId)}`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  if (!res.ok) return null;
  const json = await readJsonSafe(res);
  return normalizeXexunPosition({
    ...json,
    lat: json.location?.lat ?? json.gps?.lat ?? null,
    lng: json.location?.lng ?? json.gps?.lng ?? null,
    deviceTimeUtc: json.gps?.timestamp ?? null,
    lastUpdateServer: json.lastUpdate ?? null,
    received: json.received ?? null,
    raw: json.raw ?? null,
  });
}

async function fetchVendorPosition(deviceId) {
  const base = vendorBase();
  const path = `/api/positions?deviceId=${encodeURIComponent(deviceId)}`;
  const url = base === '' ? path : `${base}${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
    credentials: 'include',
  });

  if (!res.ok) {
    const err = new Error(`Vendor returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const latest = pickLatest(data);
  const normalized = normalizeVendorPosition(latest);
  if (!normalized || Number.isNaN(normalized.lat) || Number.isNaN(normalized.lng)) {
    throw new Error('No position for this device id yet, or API shape changed.');
  }
  return normalized;
}

async function fetchBffHistory(deviceId, { limit = 240 } = {}) {
  const base = bffBase();
  const path = `/history?deviceId=${encodeURIComponent(deviceId)}&limit=${encodeURIComponent(limit)}`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...bffAuthHeaders() },
    credentials: 'include',
  });
  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.error ? `History returned ${res.status} (${data.error})` : `History returned ${res.status}`);
  return (Array.isArray(data?.history) ? data.history : Array.isArray(data) ? data : [])
    .map(normalizeHistoryPoint)
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

async function fetchXexunHistory(deviceId, { limit = 240 } = {}) {
  const base = xexunBase();
  const path = `/api/app/history?deviceId=${encodeURIComponent(deviceId)}&limit=${encodeURIComponent(limit)}`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  const data = await readJsonSafe(res);
  if (!res.ok) throw new Error(data?.error ? `Tracker history ${res.status} (${data.error})` : `Tracker history returned ${res.status}`);
  return (Array.isArray(data?.history) ? data.history : [])
    .map(normalizeHistoryPoint)
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

async function fetchVendorHistory(deviceId, { limit = 240 } = {}) {
  const base = vendorBase();
  const path = `/api/positions?deviceId=${encodeURIComponent(deviceId)}&limit=${encodeURIComponent(limit)}`;
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Vendor history returned ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .map(normalizeHistoryPoint)
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-limit);
}

let mockSeed = { lat: 37.9755, lng: 23.7348 };
function mockPosition(deviceId) {
  const drift = 0.0004;
  mockSeed = {
    lat: mockSeed.lat + (Math.random() - 0.5) * drift,
    lng: mockSeed.lng + (Math.random() - 0.5) * drift,
  };
  return {
    lat: mockSeed.lat,
    lng: mockSeed.lng,
    speed: 0.6 + Math.random() * 0.4,
    address: 'Mock (no vendor URL configured)',
    deviceTime: new Date().toISOString(),
    serverTime: new Date().toISOString(),
    source: 'mock',
    _deviceId: deviceId,
  };
}

function mockHistory(deviceId) {
  const now = Date.now();
  const base = { lat: mockSeed.lat, lng: mockSeed.lng };
  return Array.from({ length: 18 }, (_, idx) => {
    const angle = idx / 2.2;
    const step = idx * 0.00018;
    return {
      id: `mock-history-${deviceId}-${idx}`,
      lat: base.lat + Math.sin(angle) * 0.0018 + step,
      lng: base.lng + Math.cos(angle) * 0.0014 + step * 0.55,
      speed: idx % 5 === 0 ? 0 : 2.4 + Math.sin(angle) * 1.2,
      timestamp: new Date(now - (18 - idx) * 12 * 60_000).toISOString(),
      source: 'mock',
      address: idx === 0 ? 'Home' : idx === 17 ? 'Returned home' : null,
    };
  });
}

/**
 * @param {string|number} deviceId device id or IMEI
 * @returns {Promise<{ lat: number, lng: number, speed: number|null, address: string|null, deviceTime: string|null, serverTime: string|null, source: string }>}
 */
export async function getLatestPosition(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) {
    const xexun = process.env.REACT_APP_XEXUN_HTTP_BASE_URL;
    throw new Error(
      xexun
        ? 'No IMEI to query — enter the collar IMEI in the field above or link it on My pets.'
        : 'Set a device ID.'
    );
  }

  if (bffBase() != null) return fetchBffPosition(id);
  if (xexunBase() != null) return fetchXexunPosition(id);
  if (vendorBase() != null) return fetchVendorPosition(id);
  return mockPosition(id);
}

export async function getPositionHistory(deviceId, opts = {}) {
  const id = String(deviceId || '').trim();
  if (!id) throw new Error('Set a device ID to load history.');
  if (bffBase() != null) return fetchBffHistory(id, opts);
  if (xexunBase() != null) return fetchXexunHistory(id, opts);
  if (vendorBase() != null) return fetchVendorHistory(id, opts);
  return mockHistory(id);
}

export function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

