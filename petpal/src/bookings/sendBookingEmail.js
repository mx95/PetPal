import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';

/**
 * Send booking confirmation emails to customer and business (best-effort).
 */
export async function sendBookingConfirmationEmail(payload) {
  const app = getFirebaseApp();
  if (!app) return { ok: false, reason: 'no_firebase' };
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  const fn = httpsCallable(functions, 'sendBookingConfirmation');
  try {
    const res = await fn(payload);
    return res.data || { ok: true };
  } catch (e) {
    console.warn('[booking email]', e?.message || e);
    return { ok: false, reason: e?.message || 'failed' };
  }
}
