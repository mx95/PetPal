/**
 * Traccar-shaped position API. Works with self-hosted Traccar or stays in mock mode.
 * Optional: proxy Traccar through your own **BFF** (Firebase Cloud Function, small Node service)
 * to avoid CORS and keep credentials off the client.
 * @see https://www.traccar.org/ Traccar REST: GET /api/positions?deviceId=…
 */

function bffBase() {
  const raw = process.env.REACT_APP_TRACKING_BFF_URL;
  if (raw == null || raw === '') return null;
  if (raw === 'same') return '';
  return String(raw).replace(/\/$/, '');
}

function traccarBase() {
  const raw = process.env.REACT_APP_TRACCAR_BASE_URL;
  if (raw == null || raw === '') return null;
  if (raw === 'same') return '';
  return String(raw).replace(/\/$/, '');
}

/** @returns {'bff' | 'traccar' | 'mock'} */
export function getTrackingDataSource() {
  if (bffBase() != null) return 'bff';
  if (traccarBase() !== null) return 'traccar';
  return 'mock';
}

export function isTraccarMode() {
  return traccarBase() !== null;
}

function authHeaders() {
  const user = process.env.REACT_APP_TRACCAR_USER;
  const pass = process.env.REACT_APP_TRACCAR_PASS;
  if (!user) return {};
  return {
    Authorization: `Basic ${btoa(`${user}:${pass || ''}`)}`,
  };
}

function timeValue(p) {
  const t = p.serverTime || p.deviceTime || p.fixTime;
  if (!t) return 0;
  return new Date(t).getTime();
}

function pickLatest(positions) {
  if (!Array.isArray(positions) || positions.length === 0) return null;
  return positions.reduce((a, b) => (timeValue(b) > timeValue(a) ? b : a));
}

export function normalizeTraccarPosition(p) {
  if (!p) return null;
  return {
    lat: typeof p.latitude === 'number' ? p.latitude : Number(p.latitude),
    lng: typeof p.longitude === 'number' ? p.longitude : Number(p.longitude),
    speed: p.speed != null ? Number(p.speed) : null,
    address: p.address || null,
    deviceTime: p.deviceTime || null,
    serverTime: p.serverTime || null,
    source: 'traccar',
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
    serverTime: json.serverTime || null,
    source: 'bff',
  };
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

  if (!res.ok) {
    const err = new Error(`Backend (BFF) returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const normalized = normalizeBffPosition(data);
  if (!normalized) {
    throw new Error('BFF response did not include usable lat/lng.');
  }
  return normalized;
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
    address: 'Mock (no Traccar URL configured)',
    deviceTime: new Date().toISOString(),
    serverTime: new Date().toISOString(),
    source: 'mock',
    _deviceId: deviceId,
  };
}

/**
 * @param {string|number} deviceId Traccar device id
 * @returns {Promise<{ lat: number, lng: number, speed: number|null, address: string|null, deviceTime: string|null, serverTime: string|null, source: string }>}
 */
export async function getLatestPosition(deviceId) {
  const id = String(deviceId || '').trim();
  if (!id) {
    throw new Error('Set a device ID (from your Traccar server).');
  }

  if (bffBase() != null) {
    return fetchBffPosition(id);
  }

  const base = traccarBase();
  if (base == null) {
    return mockPosition(id);
  }

  const path = `/api/positions?deviceId=${encodeURIComponent(id)}`;
  const url = base === '' ? path : `${base}${path}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders() },
    credentials: 'include',
  });

  if (!res.ok) {
    const err = new Error(`Traccar returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const latest = pickLatest(data);
  const normalized = normalizeTraccarPosition(latest);
  if (!normalized || Number.isNaN(normalized.lat) || Number.isNaN(normalized.lng)) {
    throw new Error('No position for this device id yet, or API shape changed.');
  }
  return normalized;
}

export function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}
