import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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

export function isFirebaseConfigured() {
  return firebaseReady;
}

/** Storage bucket from env (typically `projectId.appspot.com`). */
export function isFirebaseStorageConfigured() {
  return Boolean(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET);
}

/** Set when `REACT_APP_FIREBASE_MEASUREMENT_ID` is present. */
export function isFirebaseAnalyticsConfigured() {
  return Boolean(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID);
}
