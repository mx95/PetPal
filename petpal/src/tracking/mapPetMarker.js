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
  if (p.atHomeWifi) return 'wifi';
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

const googlePinCache = new Map();

/**
 * Render pet photo as a circular pin PNG for Google Maps Marker icons.
 * @param {string} photoUrl
 * @param {number} [size]
 * @returns {Promise<string>} data URL
 */
export function buildCircularGooglePetIconUrl(photoUrl, size = 52) {
  if (!photoUrl) return Promise.reject(new Error('no photo'));
  const cached = googlePinCache.get(photoUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!String(photoUrl).startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const w = size;
        const h = size + 12;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas unsupported'));
          return;
        }
        const cx = w / 2;
        const headR = size / 2 - 2;

        ctx.shadowColor = 'rgba(16, 24, 40, 0.28)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cx, headR, headR, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, headR, headR - 3, 0, Math.PI * 2);
        ctx.clip();
        const inner = (headR - 3) * 2;
        ctx.drawImage(img, cx - inner / 2, headR - inner / 2, inner, inner);
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx - 9, size - 3);
        ctx.lineTo(cx + 9, size - 3);
        ctx.lineTo(cx, h - 1);
        ctx.closePath();
        ctx.fill();

        const url = canvas.toDataURL('image/png');
        googlePinCache.set(photoUrl, url);
        resolve(url);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('photo load failed'));
    img.src = photoUrl;
  });
}

/**
 * @param {typeof google.maps} maps
 * @param {{ photoUrl?: string, sourceKind?: string, iconUrl?: string }} opts
 */
export function buildGooglePetMarkerIcon(maps, { photoUrl, sourceKind, iconUrl }) {
  const badge = sourceBadgeMeta(sourceKind || 'gps');
  const url = iconUrl || photoUrl;
  if (url) {
    return {
      url,
      scaledSize: new maps.Size(52, 64),
      anchor: new maps.Point(26, 62),
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
