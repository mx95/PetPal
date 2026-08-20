export function normalizeEmail(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

/** Firebase AuthError.code, or a code parsed from "Firebase: Error (auth/…)." */
export function extractAuthErrorCode(err) {
  const fromCode = typeof err?.code === 'string' ? err.code.trim() : '';
  if (fromCode.startsWith('auth/') || fromCode === 'permission-denied') return fromCode;
  const msg = String(err?.message || err || '');
  const match = msg.match(/\b(auth\/[\w-]+)\b/i);
  if (match) return match[1].toLowerCase();
  if (/permission-denied/i.test(msg)) return 'permission-denied';
  return fromCode;
}

export function mapAuthError(err, t, mode = 'login') {
  const code = extractAuthErrorCode(err);
  const generic = t(mode === 'register' ? 'auth.errors.registerGeneric' : 'auth.errors.loginGeneric');

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return t('auth.errors.incorrect');
  }
  if (code === 'auth/invalid-email' || code === 'auth/missing-email') {
    return t('auth.errors.invalidEmail');
  }
  if (code === 'auth/missing-password') return t('auth.errors.missingPassword');
  if (code === 'auth/too-many-requests') return t('auth.errors.tooMany');
  if (code === 'auth/user-disabled') return t('auth.errors.userDisabled');
  if (code === 'auth/network-request-failed') return t('auth.errors.network');
  if (code === 'auth/email-already-in-use') return t('auth.errors.emailInUse');
  if (code === 'auth/weak-password') return t('auth.errors.weakPassword');
  if (code === 'permission-denied') return t('auth.errors.firestorePermissionDenied');
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return t('auth.errors.popupClosed');
  }
  if (code === 'auth/redirect-cancelled-by-user') {
    return t('auth.errors.popupClosed');
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return t('auth.errors.accountExistsDifferent');
  }
  if (code === 'auth/unauthorized-domain') return t('auth.errors.unauthorizedDomain');
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    if (typeof console !== 'undefined') {
      // Helpful when diagnosing Google/Apple setup (config is public on web).
      // eslint-disable-next-line no-console
      console.warn('[auth] provider disabled — enable it in Firebase Authentication → Sign-in method', {
        code,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      });
    }
    return t('auth.errors.providerDisabled');
  }
  if (code === 'auth/firebase-not-configured') return t('auth.errors.firebaseNotConfigured');
  // Never surface raw Firebase strings like "Firebase: Error (auth/wrong-password)."
  return generic;
}

export function trackAuthEvent(eventName, payload = {}) {
  if (process.env.NODE_ENV === 'production') return;
  try {
    // eslint-disable-next-line no-console
    console.info('[auth-event]', eventName, payload);
  } catch {
    // ignore telemetry errors
  }
}
