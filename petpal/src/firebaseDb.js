import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getFirebaseApp, isFirebaseConfigured } from './firebase';

/** Firestore (leaderboard + opt-in). Requires full web config (see isFirebaseConfigured). */
let db;

export function getDb() {
  const app = getFirebaseApp();
  if (!isFirebaseConfigured() || !app) {
    throw new Error('Firebase is not configured');
  }
  if (!db) {
    const preferLongPolling =
      String(process.env.NODE_ENV) !== 'production' ||
      (typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    if (preferLongPolling) {
      db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      });
    } else {
      db = getFirestore(app);
    }
  }
  return db;
}
