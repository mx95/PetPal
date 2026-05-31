const { isPlausibleLatLng } = require("./coords");

const LBS_GEOCODE_ENABLED =
  String(process.env.LBS_GEOCODE_ENABLED ?? "1").trim() !== "0" &&
  String(process.env.LBS_GEOCODE_ENABLED ?? "1").trim().toLowerCase() !== "false";

const MLS_API_KEY = String(process.env.MLS_API_KEY || "test").trim();
const OPENCELLID_API_KEY = String(process.env.OPENCELLID_API_KEY || "").trim();
const UNWIRED_API_TOKEN = String(process.env.UNWIRED_API_TOKEN || "").trim();

const CACHE_MS = Number(process.env.LBS_GEOCODE_CACHE_MS || 300000);
const cache = new Map();

function cacheKey(mcc, mnc, cells) {
  const c0 = cells[0];
  return `${mcc}:${mnc}:${c0?.lac}:${c0?.cellId}`;
}

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return { lat: hit.lat, lng: hit.lng, provider: hit.provider };
}

function setCache(key, lat, lng, provider) {
  cache.set(key, { lat, lng, provider, ts: Date.now() });
}

async function geocodeMozilla({ mcc, mnc, cells }) {
  if (!MLS_API_KEY) return null;
  const body = {
    cellTowers: cells.slice(0, 6).map((c) => ({
      mobileCountryCode: mcc,
      mobileNetworkCode: mnc,
      locationAreaCode: c.lac,
      cellId: c.cellId,
      ...(c.signalStrength != null ? { signalStrength: c.signalStrength } : {}),
    })),
  };
  const res = await fetch(`https://location.services.mozilla.com/v1/geolocate?key=${encodeURIComponent(MLS_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const lat = data?.location?.lat;
  const lng = data?.location?.lng;
  if (!isPlausibleLatLng(lat, lng)) return null;
  return { lat: Number(lat), lng: Number(lng), provider: "mozilla-loc" };
}

async function geocodeOpenCellId({ mcc, mnc, cells }) {
  if (!OPENCELLID_API_KEY) return null;
  const c = cells[0];
  const params = new URLSearchParams({
    key: OPENCELLID_API_KEY,
    mcc: String(mcc),
    mnc: String(mnc),
    lac: String(c.lac),
    cellid: String(c.cellId),
    format: "json",
  });
  const res = await fetch(`https://opencellid.org/cell/get?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const lat = data?.lat;
  const lon = data?.lon;
  if (!isPlausibleLatLng(lat, lon)) return null;
  return { lat: Number(lat), lng: Number(lon), provider: "opencellid" };
}

async function geocodeUnwired({ mcc, mnc, cells }) {
  if (!UNWIRED_API_TOKEN) return null;
  const body = {
    token: UNWIRED_API_TOKEN,
    radio: "lte",
    mcc,
    mnc,
    address: 0,
    cells: cells.slice(0, 6).map((c) => ({ lac: c.lac, cid: c.cellId })),
  };
  const res = await fetch("https://us1.unwiredlabs.com/v2/process.php", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.status !== "ok") return null;
  const lat = data?.lat;
  const lon = data?.lon;
  if (!isPlausibleLatLng(lat, lon)) return null;
  return { lat: Number(lat), lng: Number(lon), provider: "unwiredlabs" };
}

/**
 * Resolve approximate lat/lng from cell tower IDs.
 * @param {{ mcc: number, mnc: number, cells: Array<{lac:number,cellId:number,signalStrength?:number}> }|null} towerInfo
 */
async function geocodeLbsTowers(towerInfo) {
  if (!LBS_GEOCODE_ENABLED || !towerInfo?.cells?.length) return null;

  const { mcc, mnc, cells } = towerInfo;
  const key = cacheKey(mcc, mnc, cells);
  const cached = getCached(key);
  if (cached) return cached;

  try {
    let result = await geocodeMozilla({ mcc, mnc, cells });
    if (!result) result = await geocodeUnwired({ mcc, mnc, cells });
    if (!result) result = await geocodeOpenCellId({ mcc, mnc, cells });
    if (result) setCache(key, result.lat, result.lng, result.provider);
    return result;
  } catch {
    return null;
  }
}

module.exports = {
  LBS_GEOCODE_ENABLED,
  geocodeLbsTowers,
};
