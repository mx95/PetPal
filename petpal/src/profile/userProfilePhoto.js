import { updateProfile, reload } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseStorageConfigured } from '../firebase';

/** @param {string | undefined} uid */
export function profilePhotoLocalStorageKey(uid) {
  return uid ? `petpal_profile_photo_v1_${uid}` : '';
}

export function dispatchProfilePhotoChanged() {
  try {
    window.dispatchEvent(new CustomEvent('petpal-profile-photo-changed'));
  } catch {
    // ignore
  }
}

/**
 * @param {string | undefined} uid
 * @returns {string | null}
 */
export function readLocalProfilePhotoDataUrl(uid) {
  if (!uid) return null;
  try {
    return localStorage.getItem(profilePhotoLocalStorageKey(uid));
  } catch {
    return null;
  }
}

/** @param {string | undefined} uid */
export function clearLocalProfilePhoto(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(profilePhotoLocalStorageKey(uid));
  } catch {
    // ignore
  }
  dispatchProfilePhotoChanged();
}

/**
 * Device-local override wins (same account can have cloud URL + we still show last local upload if storage failed).
 * @param {import('firebase/auth').User | null | undefined} user
 * @returns {string | null}
 */
export function getEffectiveProfilePhotoUrl(user) {
  if (!user) return null;
  const local = readLocalProfilePhotoDataUrl(user.uid);
  if (local) return local;
  return user.photoURL || null;
}

function loadImage(file) {
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

const AVATAR_MAX = 512;
const SHOP_ASSET_MAX = 800;
const JPEG_Q = 0.86;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

/**
 * @param {File} file
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function fileToAvatarJpeg(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('NOT_IMAGE');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('TOO_LARGE');
  }
  const img = await loadImage(file);
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw <= 0 || nh <= 0) throw new Error('BAD_IMAGE');
  /** Center-crop to a square so circular avatars look consistent everywhere. */
  const side = Math.min(nw, nh);
  const sx = (nw - side) / 2;
  const sy = (nh - side) / 2;
  const out = Math.min(side, AVATAR_MAX);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_Q);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('NO_BLOB'))), 'image/jpeg', JPEG_Q);
  });
  return { blob, dataUrl };
}

/**
 * Scale shop/NFC product art to fit within a max box — no square crop.
 * @param {File} file
 * @returns {Promise<{ blob: Blob, dataUrl: string }>}
 */
export async function fileToShopAssetJpeg(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('NOT_IMAGE');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('TOO_LARGE');
  }
  const img = await loadImage(file);
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw <= 0 || nh <= 0) throw new Error('BAD_IMAGE');
  const scale = Math.min(1, SHOP_ASSET_MAX / Math.max(nw, nh));
  const outW = Math.max(1, Math.round(nw * scale));
  const outH = Math.max(1, Math.round(nh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, outW, outH);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_Q);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('NO_BLOB'))), 'image/jpeg', JPEG_Q);
  });
  return { blob, dataUrl };
}

/**
 * @param {import('firebase/auth').User} user
 * @param {Blob} jpegBlob
 */
async function uploadToFirebaseStorage(user, jpegBlob) {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('NO_STORAGE');
  const storageRef = ref(storage, `profilePhotos/${user.uid}/avatar.jpg`);
  await uploadBytes(storageRef, jpegBlob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);
  await updateProfile(user, { photoURL: url });
  await reload(user);
  clearLocalProfilePhoto(user.uid);
}

/**
 * Persist profile photo: Firebase Storage + Auth when available, otherwise this device only (localStorage).
 * @param {import('firebase/auth').User} user
 * @param {File} file
 */
export async function saveUserProfilePhoto(user, file) {
  const { blob, dataUrl } = await fileToAvatarJpeg(file);
  if (isFirebaseStorageConfigured() && getFirebaseStorage()) {
    try {
      await uploadToFirebaseStorage(user, blob);
      dispatchProfilePhotoChanged();
      return { mode: 'firebase' };
    } catch {
      // fall through to local-only
    }
  }
  try {
    localStorage.setItem(profilePhotoLocalStorageKey(user.uid), dataUrl);
  } catch {
    throw new Error('LOCAL_STORAGE_FULL');
  }
  dispatchProfilePhotoChanged();
  return { mode: 'local' };
}

/**
 * Remove custom photo: clear local override and Auth photoURL.
 * @param {import('firebase/auth').User} user
 */
export async function removeUserProfilePhoto(user) {
  clearLocalProfilePhoto(user.uid);
  try {
    await updateProfile(user, { photoURL: null });
    await reload(user);
  } catch {
    try {
      await updateProfile(user, { photoURL: '' });
      await reload(user);
    } catch {
      // local still cleared
    }
  }
  dispatchProfilePhotoChanged();
}
