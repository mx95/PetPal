import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';

function mapCallableError(err) {
  const code = err?.code || '';
  const msg = typeof err?.message === 'string' ? err.message : '';
  if (code === 'functions/unauthenticated') return 'Please sign in and try again.';
  if (code === 'functions/invalid-argument') return msg || 'Please check your message and try again.';
  if (code === 'functions/unavailable') return 'Could not reach the server. Try again in a moment.';
  return msg || 'Could not send your message. Please try again.';
}

/**
 * @param {{ name: string, email: string, subject: string, message: string }} payload
 */
export async function submitContactMessage(payload) {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  const fn = httpsCallable(functions, 'submitContactForm');
  try {
    await fn({
      name: String(payload.name || '').trim(),
      email: String(payload.email || '').trim(),
      subject: String(payload.subject || '').trim(),
      message: String(payload.message || '').trim(),
    });
  } catch (e) {
    throw new Error(mapCallableError(e));
  }
}
