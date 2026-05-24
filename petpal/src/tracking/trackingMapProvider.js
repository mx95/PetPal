/**
 * Tracking maps default to OpenStreetMap (Leaflet) for a clean, app-like look.
 * Google Maps is still used for Nearby / Places when REACT_APP_GOOGLE_MAPS_API_KEY is set.
 *
 * Set REACT_APP_TRACKING_MAP=google to use Google on the Tracker page instead.
 */
export function trackingUsesGoogleMaps() {
  const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  if (!googleKey) return false;
  const pref = String(process.env.REACT_APP_TRACKING_MAP || 'osm').trim().toLowerCase();
  return pref === 'google';
}
