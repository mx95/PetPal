import { saveHomeAnchor } from './homeAnchorStorage';
import { saveHomeLocation } from './petpalVendorClient';

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
        saveHomeAnchor(id, lat, lng, { source: 'phone' });
        try {
          await saveHomeLocation(id, lat, lng);
        } catch {
          /* saved locally; server sync optional */
        }
        resolve({ lat, lng });
      },
      () => {
        reject(Object.assign(new Error('geo_denied'), { code: 'geo_denied' }));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}
