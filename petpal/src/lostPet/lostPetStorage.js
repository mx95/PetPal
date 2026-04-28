const PREMIUM_KEY = (uid) => `petpal_premium_unlock_${uid}`;
const LIST_KEY = (uid) => `petpal_lost_alerts_${uid}`;

export function loadPremiumUnlocked(uid) {
  if (!uid) return false;
  try {
    return localStorage.getItem(PREMIUM_KEY(uid)) === '1';
  } catch {
    return false;
  }
}

export function savePremiumUnlocked(uid, on) {
  if (!uid) return;
  try {
    if (on) localStorage.setItem(PREMIUM_KEY(uid), '1');
    else localStorage.removeItem(PREMIUM_KEY(uid));
  } catch {
    // ignore
  }
}

export function loadLostListings(uid) {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(LIST_KEY(uid));
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function saveLostListings(uid, listings) {
  if (!uid) return;
  try {
    localStorage.setItem(LIST_KEY(uid), JSON.stringify(listings));
  } catch {
    // ignore
  }
}
