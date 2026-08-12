import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, getDb, isFirebaseConfigured } from '../firebase';
import { normalizeEmail } from './authUtils';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function appleProvider() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}

function normalizeAccountName(value) {
  return String(value || '').trim().toLocaleLowerCase();
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
 * Google / Apple popup sign-in.
 * Requires the provider to be enabled in Firebase Console → Authentication → Sign-in method.
 * Production web config must use project petpal-aecda (authDomain petpal-aecda.firebaseapp.com).
 */
export async function signInWithSocialProvider(providerId) {
  if (!auth) {
    const err = new Error('firebase_not_configured');
    err.code = 'auth/firebase-not-configured';
    throw err;
  }
  const provider = providerId === 'apple' ? appleProvider() : googleProvider;
  const cred = await signInWithPopup(auth, provider);
  try {
    await ensureSocialUserProfile(cred.user);
  } catch (profileErr) {
    console.warn('social profile ensure failed', profileErr);
  }
  return cred;
}
