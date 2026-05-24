import L from 'leaflet';
import { trackSourceIconSvg } from '../components/icons/IconTrackSource';

/** Zoom level when following a pet on the live map (street-level, Tractive-like). */
export const LIVE_MAP_ZOOM = 17;

/**
 * @param {object|null|undefined} p
 * @returns {'gps' | 'wifi' | 'lbs'}
 */
export function normalizePointSource(p) {
  if (!p) return 'gps';
  const src = String(p.source || '').toLowerCase().trim();
  if (src === 'gps' || p.gpsValid === true) return 'gps';
  if (src === 'wifi' || src === 'wlan' || src === 'wi-fi') return 'wifi';
  if (src === 'lbs' || src === 'cell' || src.includes('tower') || src.includes('gsm')) return 'lbs';
  const acc = String(p.accuracy || '').toLowerCase();
  if (acc === 'wifi') return 'wifi';
  if (acc === 'lbs' || acc === 'low') return 'lbs';
  if (p.warningApproximate) return 'lbs';
  return p.gpsValid === false ? 'lbs' : 'gps';
}

/** @param {'gps' | 'wifi' | 'lbs'} kind */
export function sourceBadgeMeta(kind) {
  if (kind === 'wifi') return { kind: 'wifi' };
  if (kind === 'lbs') return { kind: 'lbs' };
  return { kind: 'gps' };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

/**
 * @param {{ photoUrl?: string, placeholderEmoji?: string, sourceKind?: string, name?: string }} opts
 */
export function buildLeafletPetMarkerIcon({ photoUrl, placeholderEmoji, sourceKind, name }) {
  const badge = sourceBadgeMeta(sourceKind || 'gps');
  const safeName = escapeAttr(name || 'Pet');
  const photo = photoUrl ? escapeAttr(photoUrl) : '';
  const inner = photo
    ? `<img class="pp-mapPetPin__img" src="${photo}" alt="" decoding="async" width="48" height="48" style="width:48px;height:48px;max-width:none;object-fit:cover;object-position:center;display:block" />`
    : `<span class="pp-mapPetPin__emoji" aria-hidden="true">${escapeHtml(placeholderEmoji || '🐾')}</span>`;

  const html = `
    <div class="pp-mapPetPin" role="img" aria-label="${safeName}">
      <span class="pp-mapPetPin__badge pp-mapPetPin__badge--${badge.kind}" title="${badge.kind}">${trackSourceIconSvg(badge.kind, 11)}</span>
      <div class="pp-mapPetPin__head">${inner}</div>
      <span class="pp-mapPetPin__stem" aria-hidden="true"></span>
    </div>`;

  return L.divIcon({
    className: 'pp-mapPetPin-wrap',
    html,
    iconSize: [56, 68],
    iconAnchor: [28, 64],
    popupAnchor: [0, -58],
  });
}

/**
 * @param {typeof google.maps} maps
 * @param {{ photoUrl?: string, sourceKind?: string }} opts
 */
export function buildGooglePetMarkerIcon(maps, { photoUrl, sourceKind }) {
  const badge = sourceBadgeMeta(sourceKind || 'gps');
  if (photoUrl) {
    return {
      url: photoUrl,
      scaledSize: new maps.Size(52, 52),
      anchor: new maps.Point(26, 58),
    };
  }
  const fill =
    badge.kind === 'wifi' ? '#2f80ff' : badge.kind === 'lbs' ? '#667085' : '#5b37ff';
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
    scale: 11,
  };
}

/**
 * Small offset marker for source badge on Google Maps (when pet photo is used).
 * @param {typeof google.maps} maps
 * @param {{ lat: number, lng: number, sourceKind?: string }} opts
 */
export function googleSourceBadgeSymbol(maps, sourceKind) {
  const badge = sourceBadgeMeta(sourceKind || 'gps');
  const fill =
    badge.kind === 'wifi' ? '#2f80ff' : badge.kind === 'lbs' ? '#475467' : '#5b37ff';
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 5,
    label: {
      text: badge.kind === 'wifi' ? 'W' : badge.kind === 'lbs' ? 'C' : 'G',
      fontSize: '9px',
      fontWeight: '700',
    },
  };
}
