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

function normalizeVendorPosition(p) {
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

function normalizeXexunAppPosition(json) {
  // tracker-tcp-server app API shape: /api/app/position
  // { lat, lng, battery, signal, source, accuracy, lastUpdate, secondsAgo, isOnline }
  if (!json) return null;
  const lat = json.lat != null ? Number(json.lat) : Number.NaN;
  const lng = json.lng != null ? Number(json.lng) : Number.NaN;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    speed: null,
    address: null,
    deviceTime: json.lastUpdate || null,
    serverTime: json.lastUpdate || null,
    source: json.source || null,
    accuracy: json.accuracy || null,
    secondsAgo: json.secondsAgo ?? null,
    isOnline: json.isOnline ?? null,
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

        // Accept both the Cloud Function route and the tracker HTTP API route.
        const path = (req.path || '').replace(/\/+$/, '');
        const isPosition =
          path === '' || path === '/position' || path === '/api/app/position';
        const isHistory = path === '/history' || path === '/api/app/history';
        if (!isPosition && !isHistory) {
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
          const qs = new URLSearchParams({ deviceId });
          if (isHistory) {
            const limit = req.query.limit;
            const from = req.query.from;
            const to = req.query.to;
            if (limit != null) qs.set('limit', String(limit));
            if (from) qs.set('from', String(from));
            if (to) qs.set('to', String(to));
          }
          const route = isHistory ? '/api/app/history' : '/api/app/position';
          const url = `${base}${route}?${qs.toString()}`;
          const r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
          if (!r.ok) {
            res.status(502).json({ error: 'xexun_server_error', status: r.status });
            return;
          }
          const data = await r.json();
          if (isHistory) {
            res.status(200).json(data);
            return;
          }
          const normalized = normalizeXexunAppPosition(data);
          if (!normalized) {
            res.status(404).json({ error: 'no_position' });
            return;
          }
          res.status(200).json(normalized);
          return;
        }

        // Option B: vendor REST (common GPS-platform REST shape)
        const baseUrl = mustGetEnv('PETPAL_VENDOR_BASE_URL').replace(/\/$/, '');
        const url = `${baseUrl}/api/positions?deviceId=${encodeURIComponent(deviceId)}`;

        const user = getEnv('PETPAL_VENDOR_USER');
        const pass = getEnv('PETPAL_VENDOR_PASS') || '';
        const headers = { Accept: 'application/json' };
        if (user) headers.Authorization = `Basic ${b64(`${user}:${pass}`)}`;

        const r = await fetch(url, { method: 'GET', headers });
        if (!r.ok) {
          res.status(502).json({ error: 'vendor_error', status: r.status });
          return;
        }

        const data = await r.json();
        const latest = pickLatest(data);
        const normalized = normalizeVendorPosition(latest);
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

/** Default Admin app must exist before any function uses Firestore (see jccPayments ensureAdmin). */
const admin = require('firebase-admin');
try {
  admin.app();
} catch {
  admin.initializeApp();
}

Object.assign(exports, require('./jccPayments'));
Object.assign(exports, require('./subscriptionImei'));
Object.assign(exports, require('./contactForm'));
Object.assign(exports, require('./bookingEmail'));

