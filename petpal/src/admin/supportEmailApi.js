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

export async function fetchSupportEmailStatus() {
  const fn = httpsCallable(functionsClient(), 'getSupportEmailStatus');
  const res = await fn({});
  return res?.data || { configured: false };
}

export async function saveSupportSmtpConfig(payload) {
  const fn = httpsCallable(functionsClient(), 'saveSupportSmtpConfig');
  const res = await fn(payload);
  return res?.data || { ok: false };
}
