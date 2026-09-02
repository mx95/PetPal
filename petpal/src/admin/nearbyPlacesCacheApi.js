import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp, isFirebaseConfigured } from '../firebase';

function functionsClient() {
  const app = getFirebaseApp();
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return functions;
}

export async function fetchNearbyPlacesCacheMetaRemote() {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const fn = httpsCallable(functionsClient(), 'getNearbyPlacesCacheMeta');
  const res = await fn({});
  return res.data || { status: 'missing' };
}

/**
 * @param {{ placesApiKey?: string }} [opts]
 */
export async function bootstrapNearbyPlacesCacheRemote(opts = {}) {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured');
  const fn = httpsCallable(functionsClient(), 'bootstrapRefreshNearbyPlacesCache', {
    timeout: 540000,
  });
  const payload = {};
  if (opts.placesApiKey) payload.placesApiKey = opts.placesApiKey;
  const res = await fn(payload);
  return res.data || { ok: false };
}
