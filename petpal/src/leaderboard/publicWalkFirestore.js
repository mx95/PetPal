import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

export const PUBLIC_WALK_COL = 'publicWalkStats';

export function displayNameForUser(user) {
  if (!user) return 'Pet parent';
  return user.displayName?.trim() || user.email?.split('@')[0] || 'Pet parent';
}

/**
 * Write or clear a user's public leaderboard row.
 *
 * When `shareWalkDistance` is true we also publish summary game stats
 * (level, achievement XP, achievement count) so other boards can rank
 * caregivers by progression — not just kilometers.
 *
 * @param {{
 *   uid: string,
 *   user: any,
 *   shareWalkDistance: boolean,
 *   walkTotals: { day: number, week: number, year: number },
 *   level?: number,
 *   achievementXp?: number,
 *   achievementCount?: number,
 *   achievementTotal?: number,
 *   lifetimeKm?: number,
 * }} args
 */
export async function writePublicWalkStats({
  uid,
  user,
  shareWalkDistance,
  walkTotals: t,
  level,
  achievementXp,
  achievementCount,
  achievementTotal,
  lifetimeKm,
}) {
  if (!isFirebaseConfigured() || !uid) {
    return { ok: false, reason: 'no_backend' };
  }
  const db = getDb();
  const ref = doc(db, PUBLIC_WALK_COL, uid);
  if (!shareWalkDistance) {
    await setDoc(
      ref,
      {
        shareWalkDistance: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true };
  }
  await setDoc(
    ref,
    {
      shareWalkDistance: true,
      displayName: displayNameForUser(user),
      kmDay: t.day,
      kmWeek: t.week,
      kmYear: t.year,
      kmLifetime: Math.max(0, Number(lifetimeKm) || 0),
      level: Math.max(1, Number(level) || 1),
      achievementXp: Math.max(0, Number(achievementXp) || 0),
      achievementCount: Math.max(0, Number(achievementCount) || 0),
      achievementTotal: Math.max(0, Number(achievementTotal) || 0),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return { ok: true };
}

/**
 * @returns {Promise<Array<{
 *   id: string,
 *   displayName: string,
 *   kmDay: number,
 *   kmWeek: number,
 *   kmYear: number,
 *   kmLifetime: number,
 *   level: number,
 *   achievementXp: number,
 *   achievementCount: number,
 *   achievementTotal: number,
 * }>>}
 */
export async function fetchPublicLeaderboard() {
  if (!isFirebaseConfigured()) {
    return [];
  }
  const db = getDb();
  const q = query(collection(db, PUBLIC_WALK_COL), where('shareWalkDistance', '==', true), limit(300));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      displayName: String(x.displayName || 'Pet parent'),
      kmDay: Math.max(0, Number(x.kmDay) || 0),
      kmWeek: Math.max(0, Number(x.kmWeek) || 0),
      kmYear: Math.max(0, Number(x.kmYear) || 0),
      kmLifetime: Math.max(0, Number(x.kmLifetime) || 0),
      level: Math.max(1, Number(x.level) || 1),
      achievementXp: Math.max(0, Number(x.achievementXp) || 0),
      achievementCount: Math.max(0, Number(x.achievementCount) || 0),
      achievementTotal: Math.max(0, Number(x.achievementTotal) || 0),
    };
  });
}
