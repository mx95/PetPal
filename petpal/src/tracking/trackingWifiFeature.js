/**
 * Resolve tracker-tcp-server HTTP base URL for same-origin API calls.
 * @returns {string|null} '' = same origin; absolute URL; null = not configured
 */
function sameOriginTrackerApi() {
  if (typeof window === 'undefined') return false;
  const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  if (port === '5002') return true;
  // nginx proxies petpal.com.cy → tracker HTTP API on :5002
  const host = String(window.location.hostname || '').toLowerCase();
  if (window.isSecureContext && (host === 'petpal.com.cy' || host === 'www.petpal.com.cy')) {
    return true;
  }
  return false;
}

export function resolveTrackerHttpBase() {
  const raw = process.env.REACT_APP_XEXUN_HTTP_BASE_URL;
  if (raw != null && String(raw).trim() !== '') {
    if (raw === 'same') return '';
    const configured = String(raw).replace(/\/$/, '');
    // HTTPS pages cannot call plain HTTP tracker hosts (mixed content).
    if (typeof window !== 'undefined' && window.isSecureContext && /^http:\/\//i.test(configured)) {
      if (sameOriginTrackerApi()) return '';
      return null;
    }
    return configured;
  }
  if (sameOriginTrackerApi()) return '';
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
