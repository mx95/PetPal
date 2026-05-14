import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

function trimEnv(value) {
  return typeof value === 'string' ? value.trim() : value;
}

const firebaseConfig = {
  apiKey: trimEnv(process.env.REACT_APP_FIREBASE_API_KEY),
  authDomain: trimEnv(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN),
  projectId: trimEnv(process.env.REACT_APP_FIREBASE_PROJECT_ID),
  storageBucket: trimEnv(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: trimEnv(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID),
  appId: trimEnv(process.env.REACT_APP_FIREBASE_APP_ID),
  ...(trimEnv(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID)
    ? { measurementId: trimEnv(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID) }
    : {}),
};

function isFirebaseWebConfigComplete(cfg) {
  return Boolean(
    cfg.apiKey &&
      cfg.authDomain &&
      cfg.projectId &&
      cfg.storageBucket &&
      cfg.messagingSenderId &&
      cfg.appId
  );
}

const firebaseReady = isFirebaseWebConfigComplete(firebaseConfig);

/** @type {import('firebase/app').FirebaseApp | null} */
let app = null;
if (firebaseReady) {
  // Reuse the default app after HMR; a second initializeApp() throws and blanks the app.
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/** @type {import('firebase/auth').Auth | null} */
export const auth = app ? getAuth(app) : null;

/** Default Firebase app (null when web env vars are incomplete). */
export function getFirebaseApp() {
  return app;
}

/** Firestore (leaderboard + opt-in). Requires full web config (see isFirebaseConfigured). */
let db;
export function getDb() {
  if (!firebaseReady || !app) {
    throw new Error('Firebase is not configured');
  }
  if (!db) {
    db = getFirestore(app);
  }
  return db;
}

export function isFirebaseConfigured() {
  return firebaseReady;
}

/** Storage bucket from env (typically `projectId.appspot.com`). */
export function isFirebaseStorageConfigured() {
  return Boolean(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET);
}

let storageInstance = null;

/** @returns {import('firebase/storage').FirebaseStorage | null} */
export function getFirebaseStorage() {
  if (!firebaseReady || !app) return null;
  if (!isFirebaseStorageConfigured()) return null;
  if (!storageInstance) {
    try {
      storageInstance = getStorage(app);
    } catch {
      return null;
    }
  }
  return storageInstance;
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
  if (!firebaseReady || !app) return Promise.resolve(null);
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

