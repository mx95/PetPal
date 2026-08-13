import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';
import { mapContactCallableError, normalizeContactPayload, validateContactPayload } from './contactFormUtils';

/**
 * @param {{ name: string, email: string, subject: string, message: string }} payload
 */
export async function submitContactMessage(payload) {
  const app = getFirebaseApp();
  if (!app) {
    const err = new Error('contactPage.errUnavailable');
    err.code = 'firebase-missing';
    throw err;
  }
  const body = normalizeContactPayload(payload);
  const invalid = validateContactPayload(body);
  if (invalid) {
    const err = new Error(invalid);
    err.code = 'invalid-argument';
    throw err;
  }
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  const fn = httpsCallable(functions, 'submitContactForm');
  try {
    await fn(body);
  } catch (e) {
    const key = mapContactCallableError(e);
    const err = new Error(key);
    err.code = e?.code || 'functions/unknown';
    throw err;
  }
}
