import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase';
import { fileToAvatarJpeg } from '../profile/userProfilePhoto';

/**
 * @param {File} file
 * @param {'nfc'|'tracker'} kind
 * @param {number} [designId]
 */
export async function uploadShopAssetImage(file, kind, designId) {
  const storage = getFirebaseStorage();
  if (!storage || !file) throw new Error('Storage is not available.');
  const { blob } = await fileToAvatarJpeg(file);
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path =
    kind === 'tracker'
      ? `shopAssets/tracker-${token}.jpg`
      : `shopAssets/nfc/${designId}-${token}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
