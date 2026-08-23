import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseApp, getFirebaseStorage } from '../firebase';
import { fileToShopAssetJpeg } from '../profile/userProfilePhoto';

const REGION = 'europe-west1';

function functionsClient() {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  const functions = getFunctions(app, REGION);
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return functions;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      resolve(dataUrl.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('read_failed'));
    reader.readAsDataURL(blob);
  });
}

async function uploadViaCallable(blob, kind, designId) {
  const imageBase64 = await blobToBase64(blob);
  const fn = httpsCallable(functionsClient(), 'uploadShopAsset');
  const result = await fn({
    kind,
    designId: kind === 'nfc' ? designId : undefined,
    imageBase64,
  });
  const url = result?.data?.url;
  if (!url) throw new Error('Upload did not return a URL.');
  return url;
}

async function uploadViaStorageClient(blob, kind, designId) {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('Storage is not available.');
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path =
    kind === 'tracker'
      ? `shopAssets/tracker-${token}.jpg`
      : `shopAssets/nfc/${designId}-${token}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/**
 * @param {File} file
 * @param {'nfc'|'tracker'} kind
 * @param {number} [designId]
 */
export async function uploadShopAssetImage(file, kind, designId) {
  if (!file) throw new Error('No file selected.');
  const { blob } = await fileToShopAssetJpeg(file);
  try {
    return await uploadViaCallable(blob, kind, designId);
  } catch (callableErr) {
    try {
      return await uploadViaStorageClient(blob, kind, designId);
    } catch (storageErr) {
      throw callableErr?.message ? callableErr : storageErr;
    }
  }
}
