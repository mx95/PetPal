import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebaseStorage } from '../firebase';
import { fileToListingPhotoJpeg, photoUrlToUploadFile } from './photoUploadUtils';

function randToken() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * @param {{ uid: string, scope: string, entityId: string, file: File, index?: number }} params
 */
export async function uploadScopedPhoto({ uid, scope, entityId, file, index = 0 }) {
  const storage = getFirebaseStorage();
  if (!storage || !uid || !file || !entityId) return null;
  const { blob } = await fileToListingPhotoJpeg(file);
  const safeScope = String(scope || 'photos').replace(/[^\w-]/g, '');
  const safeEntity = String(entityId || '').replace(/[^\w-]/g, '');
  const path = `${safeScope}/${uid}/${safeEntity}/${Date.now()}-${index}-${randToken()}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const photoUrl = await getDownloadURL(storageRef);
  return { photoUrl, storagePath: path };
}

export async function deleteScopedPhotoByPath(path) {
  const storage = getFirebaseStorage();
  if (!storage || !path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // ignore missing objects
  }
}

/**
 * @param {Array<{ file?: File, storagePath?: string }>} drafts
 * @param {{ uid: string, scope: string, entityId: string }} ctx
 */
export async function uploadPhotoDrafts(drafts, ctx) {
  const out = [];
  for (let i = 0; i < drafts.length; i += 1) {
    const d = drafts[i];
    if (d.storagePath && d.photoUrl) {
      out.push({ url: d.photoUrl, storagePath: d.storagePath, isPrimary: !!d.isPrimary });
      continue;
    }
    let file = d.file || null;
    if (!file && d.photoUrl) {
      const remote = String(d.photoUrl).trim();
      if (remote.startsWith('http://') || remote.startsWith('https://')) {
        out.push({ url: remote, storagePath: d.storagePath || '', isPrimary: !!d.isPrimary });
        continue;
      }
      file = await photoUrlToUploadFile(remote);
    }
    if (!file) continue;
    const uploaded = await uploadScopedPhoto({
      uid: ctx.uid,
      scope: ctx.scope,
      entityId: ctx.entityId,
      file,
      index: i,
    });
    if (uploaded) {
      out.push({ url: uploaded.photoUrl, storagePath: uploaded.storagePath, isPrimary: !!d.isPrimary });
    }
  }
  return out;
}
