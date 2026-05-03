import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { useGame } from '../game/GameContext';
import { getDb, isFirebaseConfigured } from '../firebase';
import { PUBLIC_WALK_COL, writePublicWalkStats } from './publicWalkFirestore';

const PublicWalkContext = createContext(null);

export function PublicWalkProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const {
    walkTotals,
    walkLog,
    level,
    achievementXp,
    achievementCount,
    lifetimeAchievementDefs: lifeDefs,
    lifetimeStats,
  } = useGame();
  const [shareOnLeaderboard, setShareState] = useState(false);
  const [shareLoaded, setShareLoaded] = useState(false);
  const [lastSyncError, setLastSyncError] = useState(null);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setShareState(false);
      setShareLoaded(true);
      return;
    }
    const ref = doc(getDb(), PUBLIC_WALK_COL, uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setShareState(false);
        } else {
          const s = snap.data();
          setShareState(s.shareWalkDistance === true);
        }
        setShareLoaded(true);
      },
      () => {
        setShareLoaded(true);
        setShareState(false);
      }
    );
    return () => unsub();
  }, [uid]);

  const setShareOnLeaderboard = useCallback(
    async (next) => {
      setLastSyncError(null);
      if (!user?.uid) return;
      const previous = shareOnLeaderboard;
      setShareState(next);
      try {
        await writePublicWalkStats({
          uid: user.uid,
          user,
          shareWalkDistance: next,
          walkTotals,
          level,
          achievementXp,
          achievementCount,
          achievementTotal: Array.isArray(lifeDefs) ? lifeDefs.length : 0,
          lifetimeKm: lifetimeStats?.km || 0,
        });
      } catch (e) {
        setShareState(previous);
        setLastSyncError(e?.message || 'Could not save preference');
        throw e;
      }
    },
    [user, walkTotals, shareOnLeaderboard, level, achievementXp, achievementCount, lifeDefs, lifetimeStats]
  );

  const debouncRef = useRef(null);
  useEffect(() => {
    if (!uid || !user || !shareOnLeaderboard || !isFirebaseConfigured()) return;
    if (debouncRef.current) clearTimeout(debouncRef.current);
    debouncRef.current = setTimeout(() => {
      writePublicWalkStats({
        uid,
        user,
        shareWalkDistance: true,
        walkTotals,
        level,
        achievementXp,
        achievementCount,
        achievementTotal: Array.isArray(lifeDefs) ? lifeDefs.length : 0,
        lifetimeKm: lifetimeStats?.km || 0,
      })
        .then(() => setLastSyncError(null))
        .catch((e) => setLastSyncError(e?.message || 'Sync failed'));
    }, 600);
    return () => {
      if (debouncRef.current) clearTimeout(debouncRef.current);
    };
  }, [uid, user, shareOnLeaderboard, walkLog, walkTotals, level, achievementXp, achievementCount, lifeDefs, lifetimeStats]);

  const value = useMemo(
    () => ({
      shareOnLeaderboard,
      shareLoaded,
      setShareOnLeaderboard,
      lastSyncError,
      isFirestoreEnabled: isFirebaseConfigured(),
    }),
    [shareOnLeaderboard, shareLoaded, setShareOnLeaderboard, lastSyncError]
  );

  return <PublicWalkContext.Provider value={value}>{children}</PublicWalkContext.Provider>;
}

export function usePublicWalk() {
  const ctx = useContext(PublicWalkContext);
  if (!ctx) throw new Error('usePublicWalk must be used within PublicWalkProvider');
  return ctx;
}
