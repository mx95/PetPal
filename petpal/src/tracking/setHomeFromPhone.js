import { saveHomeAnchor, clearHomeAnchor } from './homeAnchorStorage';
import { saveHomeLocation, clearHomeLocationRemote } from './petpalVendorClient';

/**
 * One-tap: save phone GPS as home on device + tracker server.
 * @param {string} imei
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function setHomeFromPhone(imei) {
  return new Promise((resolve, reject) => {
    const id = String(imei || '').trim();
    if (!id) {
      reject(Object.assign(new Error('missing_imei'), { code: 'missing_imei' }));
      return;
    }
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('geo_unsupported'), { code: 'geo_unsupported' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          await setHomeCoords(id, lat, lng, { source: 'phone' });
          resolve({ lat, lng });
        } catch (err) {
          reject(err);
        }
      },
      () => {
        reject(Object.assign(new Error('geo_denied'), { code: 'geo_denied' }));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

/**
 * Save home from explicit map pin / coords (local + tracker server).
 * @param {string} imei
 * @param {number} lat
 * @param {number} lng
 * @param {{ source?: string }} [meta]
 */
export async function setHomeCoords(imei, lat, lng, meta = {}) {
  const id = String(imei || '').trim();
  if (!id) {
    throw Object.assign(new Error('missing_imei'), { code: 'missing_imei' });
  }
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    throw Object.assign(new Error('missing_home_coordinates'), { code: 'missing_home_coordinates' });
  }
  saveHomeAnchor(id, la, ln, { source: meta.source || 'map-pin' });
  try {
    await saveHomeLocation(id, la, ln);
  } catch {
    /* saved locally; server sync optional */
  }
  return { lat: la, lng: ln };
}

/**
 * Clear home locally and on the tracker server.
 * @param {string} imei
 */
export async function clearHomeCoords(imei) {
  const id = String(imei || '').trim();
  if (!id) {
    throw Object.assign(new Error('missing_imei'), { code: 'missing_imei' });
  }
  clearHomeAnchor(id);
  try {
    await clearHomeLocationRemote(id);
  } catch {
    /* local clear still applies */
  }
}
