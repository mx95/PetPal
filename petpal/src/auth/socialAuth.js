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
 * Popup auth often closes or reloads the whole tab in iOS Safari, Android Chrome,
 * installed PWAs, and Capacitor shells. Prefer full-page redirect there.
 */
export function preferSocialRedirect() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {
    /* ignore */
  }
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true;
  return standalone || isIOS || isAndroid;
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
 * Google / Apple sign-in (popup on desktop; redirect on mobile / PWA / Capacitor).
 * Requires the provider to be enabled in Firebase Console → Authentication → Sign-in method.
 * Production web: use authDomain petpal.com.cy with /__/auth reverse-proxy
 * (tracker-tcp-server) so Google redirect works on iOS Safari / Chrome.
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

  if (preferSocialRedirect()) {
    writeRedirectMeta({
      providerId,
      mode: options.mode === 'register' ? 'register' : 'login',
      returnTo: options.returnTo || '/',
      at: Date.now(),
    });
    await signInWithRedirect(auth, provider);
    return null;
  }

  const cred = await signInWithPopup(auth, provider);
  try {
    await ensureSocialUserProfile(cred.user);
  } catch (profileErr) {
    console.warn('social profile ensure failed', profileErr);
  }
  return cred;
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
