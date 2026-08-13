import { extractAuthErrorCode, mapAuthError } from './authUtils';

const STRINGS = {
  'auth.errors.incorrect': 'Incorrect email or password.',
  'auth.errors.invalidEmail': 'Please enter a valid email address.',
  'auth.errors.missingPassword': 'Please enter your password.',
  'auth.errors.tooMany': 'Too many attempts. Try again later.',
  'auth.errors.userDisabled': 'This account has been disabled.',
  'auth.errors.network': 'Network error. Check your connection and try again.',
  'auth.errors.loginGeneric': 'Login failed. Please try again.',
  'auth.errors.registerGeneric': 'Registration failed. Please try again.',
  'auth.errors.emailInUse': 'That email is already registered.',
  'auth.errors.weakPassword': 'Password must be at least 6 characters.',
  'auth.errors.firestorePermissionDenied': 'Firestore denied the profile write.',
  'auth.errors.popupClosed': 'Sign-in was cancelled.',
  'auth.errors.accountExistsDifferent': 'Account exists with a different method.',
  'auth.errors.unauthorizedDomain': 'This domain is not authorized.',
  'auth.errors.providerDisabled': 'Provider is disabled.',
  'auth.errors.firebaseNotConfigured': 'Firebase is not configured.',
};

function t(key) {
  return STRINGS[key] || key;
}

describe('extractAuthErrorCode', () => {
  it('uses err.code when present', () => {
    expect(extractAuthErrorCode({ code: 'auth/wrong-password' })).toBe('auth/wrong-password');
  });

  it('parses Firebase Error (auth/…) from the message', () => {
    expect(extractAuthErrorCode({ message: 'Firebase: Error (auth/wrong-password).' })).toBe(
      'auth/wrong-password'
    );
  });
});

describe('mapAuthError', () => {
  it('maps wrong-password to a friendly incorrect-credentials message', () => {
    expect(mapAuthError({ code: 'auth/wrong-password' }, t, 'login')).toBe(
      'Incorrect email or password.'
    );
  });

  it('maps user-not-found the same way (does not leak whether the email exists)', () => {
    expect(mapAuthError({ code: 'auth/user-not-found' }, t, 'login')).toBe(
      'Incorrect email or password.'
    );
  });

  it('never returns the raw Firebase error string', () => {
    const mapped = mapAuthError(
      { code: 'auth/wrong-password', message: 'Firebase: Error (auth/wrong-password).' },
      t,
      'login'
    );
    expect(mapped).not.toMatch(/Firebase/i);
    expect(mapped).not.toMatch(/auth\//);
    expect(mapped).toBe('Incorrect email or password.');
  });

  it('parses the code from the message when err.code is missing', () => {
    expect(mapAuthError({ message: 'Firebase: Error (auth/wrong-password).' }, t, 'login')).toBe(
      'Incorrect email or password.'
    );
  });

  it('falls back to a generic login message instead of err.message', () => {
    expect(mapAuthError({ code: 'auth/internal-error', message: 'Firebase: Error (auth/internal-error).' }, t, 'login')).toBe(
      'Login failed. Please try again.'
    );
  });

  it('falls back to a generic register message', () => {
    expect(mapAuthError({ message: 'something exploded' }, t, 'register')).toBe(
      'Registration failed. Please try again.'
    );
  });

  it('maps network and disabled-account codes', () => {
    expect(mapAuthError({ code: 'auth/network-request-failed' }, t)).toBe(
      'Network error. Check your connection and try again.'
    );
    expect(mapAuthError({ code: 'auth/user-disabled' }, t)).toBe('This account has been disabled.');
  });
});
