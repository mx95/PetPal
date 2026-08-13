import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';

function tx(t, key, params, fallback) {
  if (typeof t !== 'function') return fallback;
  const value = t(key, params);
  return value && value !== key ? value : fallback;
}

function mapCallableError(err, t) {
  const code = err?.code || '';
  const msg = typeof err?.message === 'string' ? err.message : '';
  if (code === 'functions/unauthenticated') {
    return tx(t, 'profile.payment.errSignIn', undefined, 'Please sign in again, then retry.');
  }
  if (code === 'functions/failed-precondition' || code === 'functions/invalid-argument') {
    return msg || tx(t, 'profile.payment.errRejected', undefined, 'Could not start card update.');
  }
  if (code === 'functions/not-found') {
    return tx(
      t,
      'profile.payment.errNotDeployed',
      undefined,
      'Card update is not available yet. Deploy the latest payment functions.'
    );
  }
  return msg || code || tx(t, 'profile.payment.errGeneric', undefined, 'Could not update your card.');
}

/**
 * Starts JCC hosted flow to create/replace the saved card (createJccUpdateCard).
 * @param {{ t?: (key: string, params?: object) => string }} [opts]
 * @returns {Promise<{ formUrl: string, orderNumber: string, amountCents: number }>}
 */
export async function startJccUpdateCard(opts = {}) {
  const t = opts?.t;
  const app = getFirebaseApp();
  if (!app) {
    throw new Error(
      tx(t, 'profile.payment.errFirebase', undefined, 'Firebase is not configured.')
    );
  }
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  const createJccUpdateCard = httpsCallable(functions, 'createJccUpdateCard');
  let result;
  try {
    result = await createJccUpdateCard({});
  } catch (err) {
    throw new Error(mapCallableError(err, t));
  }
  const data = result?.data || {};
  const formUrl = String(data.formUrl || '').trim();
  if (!formUrl) {
    throw new Error(
      tx(t, 'profile.payment.errNoUrl', undefined, 'Card update did not return a payment URL.')
    );
  }
  return {
    formUrl,
    orderNumber: String(data.orderNumber || ''),
    amountCents: Number(data.amountCents) || 0,
  };
}

/**
 * @param {string|null|undefined} maskedPan
 * @returns {string}
 */
export function formatMaskedCard(maskedPan) {
  const raw = String(maskedPan || '').trim();
  if (!raw) return '';
  // JCC often returns 411111******1111 or similar
  const digits = raw.replace(/\s+/g, '');
  if (/^\d{4}\*+\d{2,4}$/.test(digits) || digits.includes('*')) {
    const last4 = digits.replace(/\D/g, '').slice(-4);
    return last4 ? `•••• ${last4}` : digits;
  }
  const last4 = digits.replace(/\D/g, '').slice(-4);
  return last4 ? `•••• ${last4}` : raw;
}
