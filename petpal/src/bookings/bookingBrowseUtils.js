/** @typedef {'vet'|'saloon'|'hotel'|'bath'|'walker'|'spa'} ServiceTabId */

/**
 * @param {Record<string, unknown>} p
 * @param {ServiceTabId} tabId
 */
export function providerMatchesServiceTab(p, tabId) {
  const pt = p?.providerTypes && typeof p.providerTypes === 'object' ? p.providerTypes : {};
  if (tabId === 'vet') return Boolean(pt.vet);
  if (tabId === 'bath') return Boolean(pt.bath || pt.saloon || pt.spa);
  if (tabId === 'saloon') return Boolean(pt.saloon || pt.spa);
  if (tabId === 'hotel') return Boolean(pt.hotel);
  if (tabId === 'walker') return Boolean(pt.walker);
  if (tabId === 'spa') return Boolean(pt.spa || pt.saloon || pt.bath);
  return true;
}

/**
 * Pick the best service for a provider browse tab.
 * @param {Array<{ id: string, type?: string, name?: string, active?: boolean }>} services
 * @param {ServiceTabId} serviceTab
 */
export function pickDefaultServiceForTab(services, serviceTab) {
  const act = (services || []).filter((s) => s && s.active !== false);
  if (!act.length) return null;
  const forTab = act.filter((s) => {
    const type = String(s.type || 'vet');
    if (serviceTab === 'bath') return type === 'bath' || /bath/i.test(String(s.name || ''));
    if (serviceTab === 'saloon') return type === 'saloon' || type === 'bath' || type === 'spa';
    if (serviceTab === 'vet') return type === 'vet';
    if (serviceTab === 'hotel') return type === 'hotel';
    if (serviceTab === 'walker') {
      return type === 'walker' || /walk|walker/i.test(String(s.name || ''));
    }
    if (serviceTab === 'spa') {
      return type === 'spa' || /spa/i.test(String(s.name || '')) || type === 'saloon' || type === 'bath';
    }
    return true;
  });
  return forTab[0] || act[0] || null;
}

/**
 * @param {Record<string, unknown>} p
 * @param {string} q
 */
export function matchesSearch(p, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return (
    String(p.displayName || '')
      .toLowerCase()
      .includes(s) ||
    String(p.address || '')
      .toLowerCase()
      .includes(s) ||
    String(p.phone || '')
      .toLowerCase()
      .includes(s)
  );
}

/**
 * @param {number} rating
 * @param {'any'|'4'|'4.5'} filter
 */
export function matchesRatingFilter(rating, filter) {
  if (filter === 'any') return true;
  const r = Number(rating);
  if (!Number.isFinite(r) || r <= 0) return false;
  if (filter === '4') return r >= 4;
  if (filter === '4.5') return r >= 4.5;
  return true;
}

const HIDDEN_DEMO_PROVIDER_NAMES = new Set([
  'petpal demo grooming',
  'fluffy cuts grooming & pet shop',
  'paws & care vet clinic',
  'sotiris demo',
]);

const HIDDEN_DEMO_EMAIL_SNIPPETS = [
  'business.demo@petpal.com.cy',
  '@fluffycuts.petpal.app',
  '@paws-care.petpal.app',
];

/**
 * Seeded / offline demo businesses that should not appear in Bookings or Nearby.
 * @param {Record<string, unknown>|null|undefined} provider
 */
export function isHiddenDemoProvider(provider) {
  if (!provider || typeof provider !== 'object') return false;
  const name = String(provider.displayName || '').trim().toLowerCase();
  if (name && HIDDEN_DEMO_PROVIDER_NAMES.has(name)) return true;
  // Catch "Something Demo" test listings used for boost previews.
  if (/\bdemo\b/i.test(name) && /(sotiris|petpal|test|sample|example)/i.test(name)) return true;
  const contact = `${provider.email || ''} ${provider.publicEmail || ''} ${provider.phone || ''}`.toLowerCase();
  if (HIDDEN_DEMO_EMAIL_SNIPPETS.some((s) => contact.includes(s))) return true;
  const address = String(provider.address || '').toLowerCase();
  if (address.includes('artemidos 4') && address.includes('xylofagou')) return true;
  return false;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const r = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(r * c * 10) / 10;
}

/** @param {unknown} v */
function finiteCoord(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Map pin for a provider: flat lat/lng, numeric strings, or GeoPoint-like { latitude, longitude }.
 * @param {Record<string, unknown>} p
 * @returns {{ lat: number, lng: number } | null}
 */
export function providerLatLng(p) {
  if (!p || typeof p !== 'object') return null;
  const nested = p.geo ?? p.location ?? p.coordinates ?? p.position;
  if (nested && typeof nested === 'object') {
    const latRaw = 'latitude' in nested ? nested.latitude : nested.lat;
    const lngRaw = 'longitude' in nested ? nested.longitude : nested.lng;
    const lat = finiteCoord(latRaw);
    const lng = finiteCoord(lngRaw);
    if (lat != null && lng != null) return { lat, lng };
  }
  const lat = finiteCoord(p.lat);
  const lng = finiteCoord(p.lng);
  if (lat != null && lng != null) return { lat, lng };
  return null;
}

/**
 * @param {Record<string, unknown>} p
 * @param {{ lat: number, lng: number } | null} userLoc
 */
export function providerDistanceKm(p, userLoc) {
  if (!userLoc) return null;
  const ll = providerLatLng(p);
  if (!ll) return null;
  return haversineKm(userLoc.lat, userLoc.lng, ll.lat, ll.lng);
}

/**
 * True when a provider should appear as “recommended” in UI (honours optional `boostUntil`).
 * @param {Record<string, unknown> | null | undefined} p
 */
function boostTimestampActive(until) {
  if (until == null) return true;
  let ms = null;
  if (typeof until.toMillis === 'function') ms = until.toMillis();
  else if (typeof until.seconds === 'number') ms = until.seconds * 1000;
  if (ms == null || !Number.isFinite(ms)) return true;
  return ms > Date.now();
}

/** @param {Record<string, unknown> | null | undefined} p */
export function providerNearbyBoostIsActive(p) {
  if (!p || typeof p !== 'object') return false;
  const flagged = Boolean(p.boostNearbyEnabled || p.sponsored || p.boostEnabled);
  if (!flagged) return false;
  const until = p.boostNearbyUntil ?? p.boostUntil;
  return boostTimestampActive(until);
}

/** @param {Record<string, unknown> | null | undefined} p */
export function providerBookingsBoostIsActive(p) {
  if (!p || typeof p !== 'object') return false;
  const flagged = Boolean(p.boostBookingsEnabled || p.recommended || p.boostEnabled);
  if (!flagged) return false;
  const until = p.boostBookingsUntil ?? p.boostUntil;
  return boostTimestampActive(until);
}

export function providerBoostIsActive(p) {
  return providerNearbyBoostIsActive(p) || providerBookingsBoostIsActive(p);
}
