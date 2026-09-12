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
    return 'Assign IMEI backend is not deployed. Deploy assignSubscriptionImei / adminAssignPetTrackingDevice.';
  }
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Could not reach Firebase Functions. Check network and try again.';
  }
  return msg;
}

/**
 * @param {{ uid: string, subscriptionId?: string, paymentId?: string, subPaymentId?: number, imei: string, petId?: string }} payload
 */
export async function adminAssignSubscriptionImei(payload) {
  const fn = httpsCallable(functionsClient(), 'assignSubscriptionImei', {
    timeout: CALLABLE_TIMEOUT_MS,
  });
  try {
    const res = await fn(payload);
    return res.data;
  } catch (err) {
    throw new Error(callableErrorMessage(err));
  }
}

/**
 * @param {{ uid: string, petId: string, imei?: string, clear?: boolean }} payload
 */
export async function adminAssignPetTrackingDevice(payload) {
  const fn = httpsCallable(functionsClient(), 'adminAssignPetTrackingDevice', {
    timeout: CALLABLE_TIMEOUT_MS,
  });
  try {
    const res = await fn(payload);
    return res.data;
  } catch (err) {
    throw new Error(callableErrorMessage(err));
  }
}

/**
 * @param {{ petId: string, imei: string }} payload
 */
export async function linkTrackerSubscriptionPet(payload) {
  const fn = httpsCallable(functionsClient(), 'linkTrackerSubscriptionPet', {
    timeout: CALLABLE_TIMEOUT_MS,
  });
  try {
    const res = await fn(payload);
    return res.data;
  } catch (err) {
    throw new Error(callableErrorMessage(err));
  }
}
