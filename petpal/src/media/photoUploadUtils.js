/** @typedef {{ id: string, previewUrl: string, storagePath?: string, photoUrl?: string, isPrimary?: boolean, file?: File, uploading?: boolean, error?: string }} PhotoDraft */

export const PHOTO_MAX_COUNT = 6;
/** Pre-compression pick limit in MultiPhotoUpload (large phone photos are resized before upload). */
export const PHOTO_MAX_BYTES = 24 * 1024 * 1024;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

const LISTING_PHOTO_MAX = 1600;
const LISTING_JPEG_Q = 0.86;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_LOAD'));
    };
    img.src = url;
  });
}

/**
 * Resize a listing photo to fit within LISTING_PHOTO_MAX — no square crop.
 * @param {File} file
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function fileToListingPhotoJpeg(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('NOT_IMAGE');
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new Error('TOO_LARGE');
  }
  const img = await loadImageFromFile(file);
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w <= 0 || h <= 0) throw new Error('BAD_IMAGE');
  const scale = Math.min(1, LISTING_PHOTO_MAX / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, outW, outH);
  const dataUrl = canvas.toDataURL('image/jpeg', LISTING_JPEG_Q);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('NO_BLOB'))), 'image/jpeg', LISTING_JPEG_Q);
  });
  return { blob, dataUrl };
}

/**
 * Compress a picked photo for lost-pet / shelter / adoption uploads.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function prepareListingPhotoFile(file) {
  const { blob } = await fileToListingPhotoJpeg(file);
  return new File([blob], 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * @param {string} url
 * @returns {Promise<File | null>}
 */
export async function photoUrlToUploadFile(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  if (s.startsWith('data:')) {
    try {
      const blob = await (await fetch(s)).blob();
      if (!blob.type.startsWith('image/')) return null;
      return new File([blob], 'seed.jpg', { type: blob.type || 'image/jpeg', lastModified: Date.now() });
    } catch {
      return null;
    }
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const blob = await (await fetch(s)).blob();
      if (!blob.type.startsWith('image/')) return null;
      return new File([blob], 'remote.jpg', { type: blob.type || 'image/jpeg', lastModified: Date.now() });
    } catch {
      return null;
    }
  }
  return null;
}

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
