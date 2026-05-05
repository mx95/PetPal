const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function getConfig(path, fallback = null) {
  try {
    const cfg = functions.config && functions.config();
    if (!cfg) return fallback;
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), cfg) ?? fallback;
  } catch {
    return fallback;
  }
}

function b64(s) {
  return Buffer.from(s, 'utf8').toString('base64');
}

function normalizeTraccarPosition(p) {
  if (!p) return null;
  const lat = p.latitude != null ? Number(p.latitude) : Number.NaN;
  const lng = p.longitude != null ? Number(p.longitude) : Number.NaN;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    speed: p.speed != null ? Number(p.speed) : null,
    address: p.address || null,
    deviceTime: p.deviceTime || null,
    serverTime: p.serverTime || null,
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

function normalizeXexunLatestDevice(json) {
  // tracker-tcp-server shape: { gps: {lat,lng,timestamp,speedKmh? }, deviceStatus: {...}, receivedAt, ... }
  if (!json) return null;
  const gps = json.gps || {};
  const lat = gps.lat != null ? Number(gps.lat) : Number.NaN;
  const lng = gps.lng != null ? Number(gps.lng) : Number.NaN;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    speed: gps.speedKmh != null ? Number(gps.speedKmh) : null,
    address: null,
    deviceTime: gps.timestamp || null,
    serverTime: json.receivedAt || null,
  };
}

exports.tracking = functions
  .region('europe-west1')
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      try {
        const token = getEnv('PETPAL_BFF_TOKEN');
        if (token) {
          const h = String(req.headers.authorization || '');
          if (h !== `Bearer ${token}`) {
            res.status(401).json({ error: 'unauthorized' });
            return;
          }
        }

        if (req.method !== 'GET') {
          res.status(405).json({ error: 'method_not_allowed' });
          return;
        }

        // Only one endpoint for now: /tracking/position?deviceId=…
        const path = (req.path || '').replace(/\/+$/, '');
        if (path !== '' && path !== '/position') {
          res.status(404).json({ error: 'not_found' });
          return;
        }

        const deviceId = String(req.query.deviceId || '').trim();
        if (!deviceId) {
          res.status(400).json({ error: 'missing_deviceId' });
          return;
        }

        // Option A: Xexun TCP server (deviceId == IMEI)
        const xexunBase = getEnv('XEXUN_HTTP_BASE_URL') || getConfig('xexun.http_base_url');
        if (xexunBase) {
          const base = xexunBase.replace(/\/$/, '');
          const url = `${base}/devices/${encodeURIComponent(deviceId)}`;
          const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
          if (!r.ok) {
            res.status(502).json({ error: 'xexun_server_error', status: r.status });
            return;
          }
          const data = await r.json();
          const normalized = normalizeXexunLatestDevice(data);
          if (!normalized) {
            res.status(404).json({ error: 'no_position' });
            return;
          }
          res.status(200).json(normalized);
          return;
        }

        // Option B: Traccar
        const baseUrl = mustGetEnv('TRACCAR_BASE_URL').replace(/\/$/, '');
        const url = `${baseUrl}/api/positions?deviceId=${encodeURIComponent(deviceId)}`;

        const user = getEnv('TRACCAR_USER');
        const pass = getEnv('TRACCAR_PASS') || '';
        const headers = { Accept: 'application/json' };
        if (user) headers.Authorization = `Basic ${b64(`${user}:${pass}`)}`;

        const r = await fetch(url, { method: 'GET', headers });
        if (!r.ok) {
          res.status(502).json({ error: 'traccar_error', status: r.status });
          return;
        }

        const data = await r.json();
        const latest = pickLatest(data);
        const normalized = normalizeTraccarPosition(latest);
        if (!normalized) {
          res.status(404).json({ error: 'no_position' });
          return;
        }

        res.status(200).json(normalized);
      } catch (e) {
        res.status(500).json({ error: 'internal', message: e?.message || String(e) });
      }
    });
  });

