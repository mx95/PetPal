const CONSENT_KEY = 'petpal_cookie_consent_v1';

/**
 * @returns {{ status: 'pending' } | { status: 'necessary' | 'all', version: number, savedAt: string }} 
 */
export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return { status: 'pending' };
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && (p.status === 'necessary' || p.status === 'all')) {
      return { version: 1, savedAt: p.savedAt || '', status: p.status };
    }
  } catch {
    // ignore
  }
  return { status: 'pending' };
}

/**
 * @param {'necessary' | 'all'} status — 'necessary' = no analytics; 'all' = allow optional analytics
 */
export function setCookieConsent(status) {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        version: 1,
        status,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore
  }
}

export function clearCookieConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // ignore
  }
}

export { CONSENT_KEY };
