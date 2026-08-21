import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';

function functionsClient() {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured');
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  return functions;
}

/** Admin-only: delete all broadcastMessages (clears every user’s inbox). */
export async function clearBroadcastInboxRemote() {
  const fn = httpsCallable(functionsClient(), 'clearBroadcastInbox');
  const res = await fn({});
  return res?.data || { ok: false, deleted: 0 };
}
