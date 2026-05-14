import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';

function mapCallableError(err) {
  const code = err?.code || '';
  const msg = typeof err?.message === 'string' ? err.message : '';
  if (code === 'functions/not-found') {
    return 'Checkout is not available: deploy the createJccCheckout function to europe-west1 (or enable the Functions emulator).';
  }
  if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
    return 'Cannot reach Cloud Functions. Check your network, project, and REACT_APP_FUNCTIONS_REGION (default europe-west1).';
  }
  if (code === 'functions/unauthenticated') {
    return 'Please sign in again, then retry checkout.';
  }
  if (code === 'functions/failed-precondition' || code === 'functions/invalid-argument' || code === 'functions/permission-denied') {
    return msg || 'Checkout was rejected. Check JCC credentials and return URL on the server.';
  }
  if (code === 'functions/internal') {
    return msg || 'Checkout failed on the server. Inspect Cloud Function logs.';
  }
  return msg || code || 'Checkout failed.';
}

/**
 * Starts JCC hosted checkout via Cloud Function `createJccCheckout` (register.do → formUrl).
 * @param {{ sku: string, saveCard: boolean, companyId?: string }} opts
 */
export async function startJccCheckout(opts) {
  const app = getFirebaseApp();
  if (!app) {
    throw new Error('Firebase is not configured; add REACT_APP_FIREBASE_* env vars.');
  }
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  const createJccCheckout = httpsCallable(functions, 'createJccCheckout');
  let data;
  try {
    const res = await createJccCheckout({
      sku: opts.sku,
      saveCard: Boolean(opts.saveCard),
      companyId: opts.companyId || undefined,
    });
    data = res.data;
  } catch (e) {
    throw new Error(mapCallableError(e));
  }
  const formUrl = data?.formUrl;
  if (!formUrl || typeof formUrl !== 'string') {
    throw new Error('Checkout did not return a payment URL. Check createJccCheckout logs and JCC register.do response.');
  }
  window.location.assign(formUrl);
}
