/**
 * Google calls `window.gm_authFailure` when the Maps JavaScript API key is invalid,
 * billing/API not enabled (e.g. ApiNotActivatedMapError), or referrer restrictions block the load.
 * We broadcast an app event so maps can fall back to Leaflet without a blank canvas.
 */
export const GOOGLE_MAPS_AUTH_FAILURE_EVENT = 'petpal-google-maps-auth-failure';

let installed = false;

export function installGoogleMapsAuthFailureHook() {
  if (typeof window === 'undefined' || installed) return;
  installed = true;
  const prev = window.gm_authFailure;
  window.gm_authFailure = function gmAuthFailure() {
    try {
      if (typeof prev === 'function') prev();
    } catch (_) {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_AUTH_FAILURE_EVENT));
  };
}

export function subscribeGoogleMapsAuthFailure(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, handler);
  return () => window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, handler);
}
