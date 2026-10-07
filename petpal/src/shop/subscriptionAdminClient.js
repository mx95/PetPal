import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';

const CALLABLE_TIMEOUT_MS = 60000;

function functionsClient() {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (
    process.env.NODE_ENV === 'development' &&
    (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1' ||
      process.env.REACT_APP_FUNCTIONS_EMULATOR === '1')
  ) {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return functions;
}

function callableErrorMessage(err) {
  const code = String(err?.code || '').replace(/^functions\//, '');
  const msg = String(err?.message || err || 'Request failed');
  if (code === 'not-found' && /function/i.test(msg)) {
    return 'Subscription admin functions are not deployed yet.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Could not reach Firebase Functions. Check network and try again.';
  }
  return msg;
}

async function call(name, payload) {
  const fn = httpsCallable(functionsClient(), name, { timeout: CALLABLE_TIMEOUT_MS });
  try {
    const res = await fn(payload || {});
    return res?.data;
  } catch (err) {
    throw new Error(callableErrorMessage(err));
  }
}

/** @param {{ email?: string, uid?: string }} payload */
export function adminLookupSubscriptions(payload) {
  return call('adminLookupSubscriptions', payload);
}

/** @param {{ uid: string, subscriptionId: string, kind?: string, nextRenewalAt: string }} payload */
export function adminSetSubscriptionNextRenewal(payload) {
  return call('adminSetSubscriptionNextRenewal', payload);
}

/** @param {{ uid: string, subscriptionId?: string, kind?: string, cancelAll?: boolean, clearPaymentMethod?: boolean, reason?: string }} payload */
export function adminCancelSubscription(payload) {
  return call('adminCancelSubscription', payload);
}

/** @param {{ uid: string }} payload */
export function adminClearPaymentMethod(payload) {
  return call('adminClearPaymentMethod', payload);
}
