/** @typedef {{ id: string, previewUrl: string, storagePath?: string, photoUrl?: string, isPrimary?: boolean, file?: File, uploading?: boolean, error?: string }} PhotoDraft */

export const PHOTO_MAX_COUNT = 6;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

/**
 * @param {File} file
 * @returns {{ ok: true } | { ok: false, code: 'type' | 'size' }}
 */
export function validatePhotoFile(file) {
  if (!file?.type?.startsWith('image/')) return { ok: false, code: 'type' };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, code: 'size' };
  return { ok: true };
}

export function newPhotoDraftId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `ph_${crypto.randomUUID()}`;
  return `ph_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {PhotoDraft[]} photos
 * @returns {PhotoDraft[]}
 */
export function normalizePrimaryPhoto(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  const hasPrimary = photos.some((p) => p.isPrimary);
  return photos.map((p, i) => ({ ...p, isPrimary: hasPrimary ? !!p.isPrimary : i === 0 }));
}

/**
 * @param {Array<{ url?: string, photoUrl?: string, storagePath?: string, isPrimary?: boolean }>} photos
 */
export function pickPrimaryPhotoUrl(photos) {
  if (!Array.isArray(photos) || photos.length === 0) return '';
  const primary = photos.find((p) => p.isPrimary) || photos[0];
  return String(primary?.url || primary?.photoUrl || '').trim();
}

/**
 * @param {string} [phone]
 */
export function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

/**
 * @param {number|null|undefined} lat
 * @param {number|null|undefined} lng
 */
export function mapsLink(lat, lng) {
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

/**
 * @param {import('firebase/firestore').Timestamp | string | null | undefined} v
 */
export function tsToIso(v) {
  if (!v) return '';
  try {
    if (typeof v === 'string') return v;
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
  } catch {
    // ignore
  }
  return '';
}

/**
 * @param {string} iso
 */
export function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * @param {{ title: string, text?: string, url?: string }} payload
 */
export async function shareListing(payload) {
  const url = payload.url || (typeof window !== 'undefined' ? window.location.href : '');
  const text = payload.text || payload.title;
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: payload.title, text, url });
      return { ok: true, method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url || text);
    return { ok: true, method: 'clipboard' };
  }
  return { ok: false, reason: 'unsupported' };
}
