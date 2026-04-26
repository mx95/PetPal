export function loadGameState(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`petpal_game_${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGameState(uid, state) {
  if (!uid) return;
  try {
    localStorage.setItem(`petpal_game_${uid}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}
