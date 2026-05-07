import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase';
import { fileToAvatarJpeg } from '../profile/userProfilePhoto';

function randToken() {
  return Math.random().toString(36).slice(2, 10);
}

export async function uploadPetPhoto({ uid, file, petId }) {
  const storage = getFirebaseStorage();
  if (!storage || !uid || !file) return null;
  const { blob } = await fileToAvatarJpeg(file);
  const safePetId = String(petId || '').trim();
  if (!safePetId) return null;
  const path = `petPhotos/${uid}/${safePetId}/${Date.now()}-${randToken()}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const photoUrl = await getDownloadURL(storageRef);
  return { photoUrl, photoStoragePath: path };
}

export async function deletePetPhotoByPath(path) {
  const storage = getFirebaseStorage();
  if (!storage || !path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // ignore missing or permissions issues; keep app flow resilient
  }
}

function pathFromDownloadUrl(url) {
  try {
    if (!url || typeof url !== 'string') return '';
    const m = url.match(/\/o\/([^?]+)/);
    if (!m?.[1]) return '';
    return decodeURIComponent(m[1]);
  } catch {
    return '';
  }
}

export async function deletePetPhoto({ photoStoragePath, photoUrl }) {
  const path = String(photoStoragePath || '').trim() || pathFromDownloadUrl(photoUrl);
  if (!path) return;
  await deletePetPhotoByPath(path);
}
