import L from 'leaflet';
import { kmBetween } from './positionFilter';

/** Home geofence radius shown on Live map (meters). */
export const HOME_GEOFENCE_METERS = 10;

const HOME_ACCENT = '#0f9f6e';

/**
 * @param {{ lat: number, lng: number }|null|undefined} a
 * @param {{ lat: number, lng: number }|null|undefined} b
 * @returns {number|null} meters, or null if coords invalid
 */
export function metersBetween(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  return kmBetween({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }) * 1000;
}

/** @param {{ lat: number, lng: number }|null|undefined} pet @param {{ lat: number, lng: number }|null|undefined} home */
export function isPetAtHome(pet, home, radiusM = HOME_GEOFENCE_METERS) {
  const m = metersBetween(pet, home);
  return m != null && m <= radiusM;
}

/**
 * Small house pin for Google OverlayView / Leaflet divIcon.
 * @param {{ atHome?: boolean }} [opts]
 */
export function buildMapHomePinHtml({ atHome = false } = {}) {
  const cls = `pp-mapHomePin${atHome ? ' pp-mapHomePin--atHome' : ''}`;
  return `<div class="${cls}" aria-hidden="true">
    <span class="pp-mapHomePin__glyph">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-5.2h-3.6V21H5a1 1 0 0 1-1-1v-9.5Z" fill="currentColor"/>
      </svg>
    </span>
  </div>`;
}

export function buildLeafletHomeMarkerIcon({ atHome = false } = {}) {
  return L.divIcon({
    className: 'pp-mapHomePin-wrap',
    html: buildMapHomePinHtml({ atHome }),
    iconSize: atHome ? [40, 40] : [32, 32],
    iconAnchor: atHome ? [20, 20] : [16, 16],
  });
}

export function homeGeofencePathOptions() {
  return {
    color: HOME_ACCENT,
    weight: 2,
    opacity: 0.75,
    fillColor: HOME_ACCENT,
    fillOpacity: 0.12,
    dashArray: undefined,
  };
}

export { HOME_ACCENT };
