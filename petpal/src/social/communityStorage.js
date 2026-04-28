export function loadUserFeed(uid) {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(`petpal_feed_${uid}`);
    const j = raw ? JSON.parse(raw) : [];
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function saveUserFeed(uid, posts) {
  if (!uid) return;
  try {
    localStorage.setItem(`petpal_feed_${uid}`, JSON.stringify(posts));
  } catch {
    // ignore
  }
}
