import { getFirebaseApp, isFirebaseAnalyticsConfigured, isFirebaseConfigured } from './firebase';

/**
 * Google Analytics (web) — only load after the user consents in CookieConsent (non-essential).
 * Dynamically imports the Analytics SDK so it stays out of the first-visit bundle.
 */
let analyticsInstance = null;
let analyticsInitPromise = null;

export function enableFirebaseAnalytics() {
  const app = getFirebaseApp();
  if (!isFirebaseConfigured() || !app) return Promise.resolve(null);
  if (!isFirebaseAnalyticsConfigured()) return Promise.resolve(null);
  if (analyticsInstance) return Promise.resolve(analyticsInstance);
  if (analyticsInitPromise) return analyticsInitPromise;
  analyticsInitPromise = import('firebase/analytics').then(({ getAnalytics, isSupported }) =>
    isSupported().then((ok) => {
      if (!ok) return null;
      if (!analyticsInstance) {
        analyticsInstance = getAnalytics(app);
      }
      return analyticsInstance;
    })
  );
  return analyticsInitPromise;
}

/** Returns the Analytics instance, or `null` if not consented/initialized yet. */
export function getFirebaseAnalytics() {
  return Promise.resolve(analyticsInstance);
}
