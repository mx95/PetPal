import { updateProfile, reload } from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { isFirebaseStorageConfigured } from '../firebase';
import { getFirebaseStorage } from '../firebaseStorage';
import {
  clearLocalProfilePhoto,
  dispatchProfilePhotoChanged,
  profilePhotoLocalStorageKey,
} from './userProfilePhotoLocal';

export {
  clearLocalProfilePhoto,
  dispatchProfilePhotoChanged,
  getEffectiveProfilePhotoUrl,
  profilePhotoLocalStorageKey,
  readLocalProfilePhotoDataUrl,
} from './userProfilePhotoLocal';

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
