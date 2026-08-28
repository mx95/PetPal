import { doc, getDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { PUBLIC_WALK_COL } from '../leaderboard/publicWalkFirestore';
import { dayKey } from './ownerGame';

/** @returns {Promise<{ day: string, done: string[] } | null>} */
export async function loadRemoteDailyProgress(uid) {
  if (!uid || !isFirebaseConfigured()) return null;
  try {
    const snap = await getDoc(doc(getDb(), PUBLIC_WALK_COL, uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const today = dayKey();
    if (String(data.dailyDay || '') !== today || !Array.isArray(data.dailyDone)) return null;
    return { day: today, done: data.dailyDone.map(String).filter(Boolean) };
  } catch {
    return null;
  }
}
