/**
 * Tracking maps use Google Maps when REACT_APP_GOOGLE_MAPS_API_KEY is set (default).
 * Set REACT_APP_TRACKING_MAP=osm for OpenStreetMap/Leaflet on the Tracker page instead.
 */
export function trackingUsesGoogleMaps() {
  const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  if (!googleKey) return false;
  const pref = String(process.env.REACT_APP_TRACKING_MAP || '').trim().toLowerCase();
  if (pref === 'osm' || pref === 'leaflet') return false;
  return true;
}
