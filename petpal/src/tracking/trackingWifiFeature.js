/**
 * Wi‑Fi home tracking + one-tap home need HTTPS (secure context for geolocation).
 * Default off on http:// — set REACT_APP_TRACKING_WIFI_ENABLED=1 when using HTTPS.
 */
export function isTrackingWifiEnabled() {
  const raw = String(process.env.REACT_APP_TRACKING_WIFI_ENABLED ?? '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
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
