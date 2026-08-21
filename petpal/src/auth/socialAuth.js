import {
  GoogleAuthProvider,
  OAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, getDb, isFirebaseConfigured } from '../firebase';
import { normalizeEmail } from './authUtils';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const SOCIAL_REDIRECT_META_KEY = 'petpal_social_auth_v1';

/** Shared so Login + Register can both await one getRedirectResult(). */
let redirectResultPromise = null;

function appleProvider() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}

function normalizeAccountName(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function readRedirectMeta() {
  try {
    return JSON.parse(sessionStorage.getItem(SOCIAL_REDIRECT_META_KEY) || 'null');
  } catch {
    return null;
  }
}

function clearRedirectMeta() {
  try {
    sessionStorage.removeItem(SOCIAL_REDIRECT_META_KEY);
  } catch {
    /* ignore */
  }
}

function writeRedirectMeta(meta) {
  try {
    sessionStorage.setItem(SOCIAL_REDIRECT_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

/**
 * Full-page redirect is only reliable in native shells / installed PWAs.
 * Regular mobile Safari/Chrome used to work with popup; redirect + firebaseapp.com
 * authDomain often returns to the app without a session (third-party storage block).
 */
export function preferSocialRedirect() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {
    /* ignore */
  }
  const standalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true;
  return standalone;
}

function shouldFallbackToRedirect(err) {
  const code = String(err?.code || '');
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  );
}

async function startSocialRedirect(provider, options) {
  writeRedirectMeta({
    providerId: options.providerId,
    mode: options.mode === 'register' ? 'register' : 'login',
    returnTo: options.returnTo || '/',
    at: Date.now(),
  });
  await signInWithRedirect(auth, provider);
  return null;
}

/**
 * Create / refresh Firestore profile after Google or Apple sign-in.
 * @param {import('firebase/auth').User} user
 */
export async function ensureSocialUserProfile(user) {
  if (!user || !isFirebaseConfigured()) return;
  const db = getDb();
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const email = normalizeEmail(user.email || '');
  const providers = (user.providerData || []).map((p) => p.providerId).filter(Boolean);

  if (snap.exists()) {
    await setDoc(
      ref,
      {
        email: email || snap.data()?.email || null,
        authProviders: providers.length ? providers : snap.data()?.authProviders || [],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  const name =
    String(user.displayName || '').trim() ||
    (email ? email.split('@')[0] : '') ||
    'Pet parent';

  await setDoc(
    ref,
    {
      uid: user.uid,
      email: email || null,
      accountType: 'individual',
      accountName: name,
      accountNameNormalized: normalizeAccountName(name),
      authProviders: providers,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Google / Apple sign-in.
 * Web (including mobile browsers): popup — this is what previously worked on petpal.com.cy.
 * Capacitor / installed PWA: redirect. If popup is blocked, fall back to redirect.
 *
 * Production authDomain must stay petpal-aecda.firebaseapp.com until
 * https://petpal.com.cy/__/auth/handler is registered in Google Cloud OAuth
 * (otherwise Google returns Error 400: redirect_uri_mismatch).
 *
 * @param {'google'|'apple'} providerId
 * @param {{ returnTo?: string, mode?: 'login'|'register' }} [options]
 * @returns {Promise<import('firebase/auth').UserCredential|null>} null when a redirect was started
 */
export async function signInWithSocialProvider(providerId, options = {}) {
  if (!auth) {
    const err = new Error('firebase_not_configured');
    err.code = 'auth/firebase-not-configured';
    throw err;
  }
  const provider = providerId === 'apple' ? appleProvider() : googleProvider;
  const redirectOpts = {
    providerId,
    mode: options.mode,
    returnTo: options.returnTo,
  };

  if (preferSocialRedirect()) {
    return startSocialRedirect(provider, redirectOpts);
  }

  try {
    const cred = await signInWithPopup(auth, provider);
    try {
      await ensureSocialUserProfile(cred.user);
    } catch (profileErr) {
      console.warn('social profile ensure failed', profileErr);
    }
    return cred;
  } catch (err) {
    // User cancelled intentionally — do not bounce into a full-page redirect.
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      throw err;
    }
    if (shouldFallbackToRedirect(err)) {
      return startSocialRedirect(provider, redirectOpts);
    }
    throw err;
  }
}

/**
 * Finish Google/Apple redirect after the browser returns to the app.
 * Safe to call from Login and Register — result is consumed once.
 *
 * @returns {Promise<{ cred: import('firebase/auth').UserCredential, returnTo: string, providerId: string, mode: string }|null>}
 */
export function completeSocialRedirectIfNeeded() {
  if (!auth) return Promise.resolve(null);
  if (!redirectResultPromise) {
    redirectResultPromise = (async () => {
      let cred;
      try {
        cred = await getRedirectResult(auth);
      } catch (err) {
        clearRedirectMeta();
        throw err;
      }
      if (!cred?.user) return null;

      const meta = readRedirectMeta();
      clearRedirectMeta();

      // Do not await Firestore here — a hung profile write would keep callers stuck,
      // and getRedirectResult itself is what unblocks auth on iOS/Safari.
      void ensureSocialUserProfile(cred.user).catch((profileErr) => {
        console.warn('social profile ensure failed', profileErr);
      });

      return {
        cred,
        returnTo: typeof meta?.returnTo === 'string' && meta.returnTo ? meta.returnTo : '/',
        providerId: meta?.providerId || 'google',
        mode: meta?.mode === 'register' ? 'register' : 'login',
      };
    })();
  }
  return redirectResultPromise;
}
