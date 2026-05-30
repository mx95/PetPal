/**
 * Resolve tracker-tcp-server HTTP base URL for same-origin API calls.
 * @returns {string|null} '' = same origin; absolute URL; null = not configured
 */
export function resolveTrackerHttpBase() {
  const raw = process.env.REACT_APP_XEXUN_HTTP_BASE_URL;
  if (raw != null && String(raw).trim() !== '') {
    if (raw === 'same') return '';
    return String(raw).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    if (port === '5002') return '';
  }
  return null;
}

function readWifiEnvFlag() {
  return String(process.env.REACT_APP_TRACKING_WIFI_ENABLED ?? '').trim().toLowerCase();
}

/** Device tab, Wi‑Fi map UX, BSSID / tk commands. */
export function isTrackingWifiEnabled() {
  const raw = readWifiEnvFlag();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (resolveTrackerHttpBase() != null) return true;
  if (typeof window !== 'undefined' && window.isSecureContext) return true;
  return false;
}

/** Browser geolocation ("Set home on map from phone") — not available on plain http://. */
export function isTrackingGeolocationEnabled() {
  const raw = readWifiEnvFlag();
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  if (typeof window !== 'undefined' && window.isSecureContext) return true;
  return false;
}

/** @param {object|null|undefined} position */
export function stripWifiFromPosition(position) {
  if (!position || isTrackingWifiEnabled()) return position;
  if (!position.atHomeWifi && String(position.source || '').toLowerCase() !== 'wifi') return position;
  return {
    ...position,
    atHomeWifi: false,
    source: position.source === 'wifi' ? null : position.source,
    wifiBssids: null,
  };
}
