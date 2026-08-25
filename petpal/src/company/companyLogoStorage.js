import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase';
import { fileToShopAssetJpeg } from '../profile/userProfilePhoto';

/**
 * Upload a business logo for the signed-in user.
 * @param {string} uid
 * @param {File} file
 * @returns {Promise<string>} download URL
 */
export async function uploadCompanyLogo(uid, file) {
  if (!uid) throw new Error('Not signed in.');
  if (!file) throw new Error('No file selected.');
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('Storage is not available.');

  const { blob } = await fileToShopAssetJpeg(file);
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storageRef = ref(storage, `companyLogos/${uid}/${token}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}
