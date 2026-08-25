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

/** Prevent concurrent Google/Apple popups from stacked taps. */
let socialSignInInFlight = false;

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

function configuredAuthDomain() {
  return String(
    auth?.app?.options?.authDomain || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || ''
  )
    .trim()
    .toLowerCase();
}

/**
 * Redirect sign-in only works when the Firebase auth helper is first-party
 * (authDomain matches the page host). Cross-origin authDomain (*.firebaseapp.com
 * while the app is on petpal.com.cy) loses the session in installed PWAs after
 * Google returns — the classic "back to the site but still logged out" bug.
 */
export function isAuthDomainFirstParty() {
  if (typeof window === 'undefined') return false;
  const authDomain = configuredAuthDomain();
  if (!authDomain) return false;
  const host = String(window.location.hostname || '').toLowerCase();
  if (!host) return false;
  return (
    host === authDomain ||
    host === `www.${authDomain}` ||
    authDomain === `www.${host}` ||
    host.endsWith(`.${authDomain}`)
  );
}

export function isInstalledWebApp() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {
    /* ignore */
  }
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true
  );
}

/**
 * Prefer full-page redirect only when it can complete the session:
 * Capacitor always; installed PWA only when authDomain is first-party.
 * Otherwise use popup (same as mobile Safari/Chrome).
 */
export function preferSocialRedirect() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {
    /* ignore */
  }
  if (!isInstalledWebApp()) return false;
  return isAuthDomainFirstParty();
}

function shouldFallbackToRedirect(err) {
  // Never fall back to cross-origin redirect — it silently drops the session in PWAs.
  if (!isAuthDomainFirstParty()) return false;
  const code = String(err?.code || '');
  return code === 'auth/popup-blocked';
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
 * Browser + installed PWA (until authDomain is first-party): popup.
 * Capacitor / first-party PWA: redirect.
 *
 * Production authDomain should become petpal.com.cy (with /__/auth proxy) after
 * https://petpal.com.cy/__/auth/handler is registered in Google Cloud OAuth.
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

  // Prevent double-taps from opening multiple Google popups (common cause of
  // "site closes twice then works on the third try" on mobile Safari).
  if (socialSignInInFlight) {
    const err = new Error('auth_social_in_progress');
    err.code = 'auth/cancelled-popup-request';
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

  socialSignInInFlight = true;
  try {
    const cred = await signInWithPopup(auth, provider);
    try {
      await ensureSocialUserProfile(cred.user);
    } catch (profileErr) {
      console.warn('social profile ensure failed', profileErr);
    }
    return cred;
  } catch (err) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      throw err;
    }
    if (shouldFallbackToRedirect(err)) {
      return startSocialRedirect(provider, redirectOpts);
    }
    // Installed app + blocked popup: give a clearer path than a silent logout.
    if (isInstalledWebApp() && err?.code === 'auth/popup-blocked') {
      const nicer = new Error('auth_pwa_popup_blocked');
      nicer.code = 'auth/pwa-popup-blocked';
      nicer.cause = err;
      throw nicer;
    }
    throw err;
  } finally {
    socialSignInInFlight = false;
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
