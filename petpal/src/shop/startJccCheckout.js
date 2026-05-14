import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

/**
 * Starts JCC hosted checkout via Cloud Function `createJccCheckout` (register.do → formUrl).
 * @param {{ sku: string, saveCard: boolean, companyId?: string }} opts
 */
export async function startJccCheckout(opts) {
  const app = getApp();
  const region = process.env.REACT_APP_FUNCTIONS_REGION || 'europe-west1';
  const functions = getFunctions(app, region);
  if (process.env.REACT_APP_USE_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }
  const createJccCheckout = httpsCallable(functions, 'createJccCheckout');
  const { data } = await createJccCheckout({
    sku: opts.sku,
    saveCard: Boolean(opts.saveCard),
    companyId: opts.companyId || undefined,
  });
  const formUrl = data?.formUrl;
  if (!formUrl || typeof formUrl !== 'string') {
    throw new Error('Checkout did not return a payment URL. Is the createJccCheckout function deployed?');
  }
  window.location.assign(formUrl);
}
