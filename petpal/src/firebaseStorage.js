import { getStorage } from 'firebase/storage';
import { getFirebaseApp, isFirebaseConfigured, isFirebaseStorageConfigured } from './firebase';

let storageInstance = null;

/** @returns {import('firebase/storage').FirebaseStorage | null} */
export function getFirebaseStorage() {
  const app = getFirebaseApp();
  if (!isFirebaseConfigured() || !app) return null;
  if (!isFirebaseStorageConfigured()) return null;
  if (!storageInstance) {
    try {
      storageInstance = getStorage(app);
    } catch {
      return null;
    }
  }
  return storageInstance;
}
