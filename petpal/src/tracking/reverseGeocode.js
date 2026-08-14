/** ~11 m grid — enough to reuse one street label across nearby GPS jitter. */
export function placeGridKey(lat, lng, decimals = 4) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  return `${a.toFixed(decimals)},${b.toFixed(decimals)}`;
}

/**
 * Prefer street + town over a long plus-code formatted address.
 * @param {{ address_components?: Array<{ long_name?: string, types?: string[] }>, formatted_address?: string }|null} result
 */
export function shortenGeocodeResult(result) {
  if (!result) return null;
  const comps = Array.isArray(result.address_components) ? result.address_components : [];
  const name = (type) => comps.find((c) => Array.isArray(c.types) && c.types.includes(type))?.long_name;
  const route = name('route');
  const neighborhood =
    name('neighborhood') || name('sublocality') || name('sublocality_level_1') || name('premise');
  const locality =
    name('locality') || name('postal_town') || name('administrative_area_level_2') || name('administrative_area_level_1');
  if (route && locality) return `${route}, ${locality}`;
  if (neighborhood && locality) return `${neighborhood}, ${locality}`;
  if (route) return route;
  if (neighborhood) return neighborhood;
  if (locality) return locality;
  const formatted = String(result.formatted_address || '').trim();
  if (!formatted) return null;
  return formatted.split(',').slice(0, 2).join(',').trim() || formatted;
}

const labelCache = new Map();

function googleGeocoderCtor() {
  if (typeof window === 'undefined') return null;
  return window.google?.maps?.Geocoder || null;
}

function waitForGoogleGeocoder(timeoutMs = 8000) {
  const existing = googleGeocoderCtor();
  if (existing) return Promise.resolve(existing);
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const ctor = googleGeocoderCtor();
      if (ctor) {
        window.clearInterval(id);
        resolve(ctor);
      } else if (Date.now() - start > timeoutMs) {
        window.clearInterval(id);
        resolve(null);
      }
    }, 250);
  });
}

function geocodeOnce(Geocoder, lat, lng) {
  return new Promise((resolve) => {
    try {
      const geocoder = new Geocoder();
      geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) {
          resolve(null);
          return;
        }
        resolve(shortenGeocodeResult(results[0]));
      });
    } catch {
      resolve(null);
    }
  });
}

export async function reverseGeocodeLatLng(lat, lng) {
  const key = placeGridKey(lat, lng);
  if (!key) return null;
  if (labelCache.has(key)) return labelCache.get(key);
  const Geocoder = await waitForGoogleGeocoder();
  if (!Geocoder) return null;
  const label = await geocodeOnce(Geocoder, lat, lng);
  labelCache.set(key, label);
  return label;
}

/**
 * Resolve street labels for unique nearby points (history timeline / live pin).
 * @param {Array<{ lat?: number, lng?: number }>} points
 * @param {{ maxUnique?: number }} [opts]
 * @returns {Promise<Record<string, string>>}
 */
export async function reverseGeocodePoints(points, opts = {}) {
  const maxUnique = opts.maxUnique ?? 20;
  const seen = new Set();
  const unique = [];
  for (const p of points || []) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    const key = placeGridKey(lat, lng);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({ lat, lng, key });
    if (unique.length >= maxUnique) break;
  }
  const out = {};
  for (const row of unique) {
    const label = await reverseGeocodeLatLng(row.lat, row.lng);
    if (label) out[row.key] = label;
  }
  return out;
}
