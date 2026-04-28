import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  ...(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
    ? { measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID }
    : {}),
};

// Reuse the default app after HMR; a second initializeApp() throws and blanks the app.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

/** Firestore (leaderboard + opt-in). Requires REACT_APP_FIREBASE_PROJECT_ID. */
let db;
export function getDb() {
  if (!db) {
    db = getFirestore(app);
  }
  return db;
}

export function isFirebaseConfigured() {
  return Boolean(process.env.REACT_APP_FIREBASE_PROJECT_ID);
}

/** Set when `REACT_APP_FIREBASE_MEASUREMENT_ID` is present. */
export function isFirebaseAnalyticsConfigured() {
  return Boolean(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID);
}

/**
 * Google Analytics (web) — only load after the user consents in CookieConsent (non-essential).
 * Call `enableFirebaseAnalytics()` from there; do not import getAnalytics on first paint.
 */
let analyticsInstance = null;
let analyticsInitPromise = null;

export function enableFirebaseAnalytics() {
  if (!isFirebaseAnalyticsConfigured()) return Promise.resolve(null);
  if (analyticsInstance) return Promise.resolve(analyticsInstance);
  if (analyticsInitPromise) return analyticsInitPromise;
  analyticsInitPromise = isSupported().then((ok) => {
    if (!ok) {
      return null;
    }
    if (!analyticsInstance) {
      analyticsInstance = getAnalytics(app);
    }
    return analyticsInstance;
  });
  return analyticsInitPromise;
}

/** Returns the Analytics instance, or `null` if not consented/initialized yet. */
export function getFirebaseAnalytics() {
  return Promise.resolve(analyticsInstance);
}

