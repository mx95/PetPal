import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseApp } from '../firebase';
import { expectedCheckoutCents, formatEur } from './catalog';

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
    if (/unknown product/i.test(msg)) {
      return (
        'Checkout backend is out of date (cart checkout not supported yet). ' +
        'Deploy the latest Firebase shop functions: cd petpal && npm run deploy:shop-functions'
      );
    }
    return msg || 'Checkout was rejected. Check JCC credentials and return URL on the server.';
  }
  if (code === 'functions/internal') {
    const generic = /^internal$/i.test(msg.trim());
    return generic || !msg ? 'Checkout failed on the server. Inspect Cloud Function logs for createJccCheckout.' : msg;
  }
  return msg || code || 'Checkout failed.';
}

/**
 * Starts JCC hosted checkout via Cloud Function `createJccCheckout` (register.do → formUrl).
 * @param {{ sku: string, saveCard: boolean, companyId?: string, includeTracker?: boolean, includeNfc?: boolean, nfcPetIds?: string[], cartItems?: Array<{ key: string, title: string, priceCents: number, qty: number, subtitle?: string, sku?: string, saveCard?: boolean, includeTracker?: boolean, includeNfc?: boolean, nfcPetIds?: string[], recurring?: boolean }>, shippingContact?: { receiverName: string, email: string, phone: string, address: string } }} opts
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
    const nfcPetIds = Array.isArray(opts.nfcPetIds)
      ? opts.nfcPetIds.map(String).filter(Boolean)
      : [];
    const cartItems = Array.isArray(opts.cartItems)
      ? opts.cartItems.map((row) => ({
          key: String(row.key || ''),
          title: String(row.title || ''),
          subtitle: row.subtitle ? String(row.subtitle) : undefined,
          priceCents: Number(row.priceCents) || 0,
          qty: Math.max(1, Number(row.qty) || 1),
          sku: row.sku ? String(row.sku) : undefined,
          productId: row.productId ? String(row.productId) : undefined,
          saveCard: Boolean(row.saveCard),
          includeTracker: Boolean(row.includeTracker),
          includeNfc: Boolean(row.includeNfc),
          nfcPetIds: Array.isArray(row.nfcPetIds) ? row.nfcPetIds.map(String).filter(Boolean) : undefined,
          selectedDesignId:
            row.selectedDesignId != null && Number.isFinite(Number(row.selectedDesignId))
              ? Number(row.selectedDesignId)
              : undefined,
          recurring: Boolean(row.recurring),
        }))
      : undefined;
    const res = await createJccCheckout({
      sku: opts.sku,
      saveCard: Boolean(opts.saveCard),
      companyId: opts.companyId || undefined,
      includeTracker: Boolean(opts.includeTracker),
      includeNfc: Boolean(opts.includeNfc),
      nfcPetIds,
      cartItems,
      shippingContact: opts.shippingContact
        ? {
            email: String(opts.shippingContact.email || ''),
            phone: String(opts.shippingContact.phone || ''),
            firstName: String(opts.shippingContact.firstName || ''),
            lastName: String(opts.shippingContact.lastName || ''),
            receiverName: String(opts.shippingContact.receiverName || ''),
            address: String(opts.shippingContact.address || ''),
            addressLine1: String(opts.shippingContact.addressLine1 || ''),
            addressLine2: String(opts.shippingContact.addressLine2 || ''),
            postalCode: String(opts.shippingContact.postalCode || ''),
            city: String(opts.shippingContact.city || ''),
            country: String(opts.shippingContact.country || 'CY'),
          }
        : undefined,
    });
    data = res.data;
  } catch (e) {
    throw new Error(mapCallableError(e));
  }
  const formUrl = data?.formUrl;
  if (!formUrl || typeof formUrl !== 'string') {
    throw new Error('Checkout did not return a payment URL. Check createJccCheckout logs and JCC register.do response.');
  }

  const expected = expectedCheckoutCents(opts.sku, {
    includeTracker: opts.includeTracker,
    includeNfc: opts.includeNfc,
    cartItems: opts.cartItems,
  });
  const charged = Number(data?.amountCents);
  if (expected != null && Number.isFinite(charged) && charged !== expected) {
    throw new Error(
      `Payment server sent ${formatEur(charged)} but this plan should be ${formatEur(expected)}. ` +
        'Deploy the latest Cloud Functions (createJccCheckout) — the live server may still be on old €4.99 pricing.'
    );
  }

  window.location.assign(formUrl);
}
