export function normalizeEmail(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

export function mapAuthError(err, t, mode = 'login') {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential') return t('auth.errors.incorrect');
  if (code === 'auth/invalid-email') return t('auth.errors.invalidEmail');
  if (code === 'auth/too-many-requests') return t('auth.errors.tooMany');
  if (code === 'auth/email-already-in-use') return t('auth.errors.emailInUse');
  if (code === 'auth/weak-password') return t('auth.errors.weakPassword');
  if (code === 'permission-denied') return t('auth.errors.firestorePermissionDenied');
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return t('auth.errors.popupClosed');
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return t('auth.errors.accountExistsDifferent');
  }
  if (code === 'auth/unauthorized-domain') return t('auth.errors.unauthorizedDomain');
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return t('auth.errors.providerDisabled');
  }
  if (code === 'auth/firebase-not-configured') return t('auth.errors.firebaseNotConfigured');
  return err?.message || t(mode === 'register' ? 'auth.errors.registerGeneric' : 'auth.errors.loginGeneric');
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
