import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';

function functionsClient() {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  return functions;
}

/**
 * @param {{ uid: string, subscriptionId?: string, paymentId?: string, subPaymentId?: number, imei: string }} payload
 */
export async function adminAssignSubscriptionImei(payload) {
  const fn = httpsCallable(functionsClient(), 'assignSubscriptionImei');
  const res = await fn(payload);
  return res.data;
}

/**
 * @param {{ petId: string, imei: string }} payload
 */
export async function linkTrackerSubscriptionPet(payload) {
  const fn = httpsCallable(functionsClient(), 'linkTrackerSubscriptionPet');
  const res = await fn(payload);
  return res.data;
}
