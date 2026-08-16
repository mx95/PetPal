import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase';
import { fileToAvatarJpeg } from '../profile/userProfilePhoto';

function randToken() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * @param {{ uid: string, file: File, productKey?: string }} args
 */
export async function uploadMarketplaceProductPhoto({ uid, file, productKey }) {
  const storage = getFirebaseStorage();
  if (!storage || !uid || !file) return null;
  const { blob } = await fileToAvatarJpeg(file);
  const key = String(productKey || 'new').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'new';
  const path = `productPhotos/${uid}/${key}/${Date.now()}-${randToken()}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const imageUrl = await getDownloadURL(storageRef);
  return { imageUrl, imageStoragePath: path };
}

export async function deleteMarketplaceProductPhotoByPath(path) {
  const storage = getFirebaseStorage();
  if (!storage || !path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // ignore
  }
}
