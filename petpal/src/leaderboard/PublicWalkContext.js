import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { useGame } from '../game/GameContext';
import { usePets } from '../pets/PetsContext';
import { getDb, isFirebaseConfigured } from '../firebase';
import { PUBLIC_WALK_COL, writePublicWalkStats } from './publicWalkFirestore';

const PublicWalkContext = createContext(null);

export function PublicWalkProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { pets } = usePets();
  const {
    walkTotals,
    walkLog,
    daily,
    level,
    achievementXp,
    achievementCount,
    lifetimeAchievementDefs: lifeDefs,
    lifetimeStats,
  } = useGame();
  const [shareOnLeaderboard, setShareState] = useState(true);
  const [shareLoaded, setShareLoaded] = useState(false);
  const [lastSyncError, setLastSyncError] = useState(null);

  const primaryPetName = useMemo(() => {
    const first = pets?.[0];
    return first?.name?.trim?.() || '';
  }, [pets]);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setShareState(true);
      setShareLoaded(true);
      return;
    }
    const ref = doc(getDb(), PUBLIC_WALK_COL, uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setShareState(true);
        } else {
          const s = snap.data();
          setShareState(s.shareWalkDistance !== false);
        }
        setShareLoaded(true);
      },
      () => {
        setShareLoaded(true);
        setShareState(true);
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
          petName: primaryPetName,
          dailyDay: daily?.day,
          dailyDone: daily?.done,
        });
      } catch (e) {
        setShareState(previous);
        setLastSyncError(e?.message || 'Could not save preference');
        throw e;
      }
    },
    [
      user,
      walkTotals,
      shareOnLeaderboard,
      level,
      achievementXp,
      achievementCount,
      lifeDefs,
      lifetimeStats,
      primaryPetName,
      daily,
    ]
  );

  const debouncRef = useRef(null);
  useEffect(() => {
    if (!uid || !user || !shareLoaded || !isFirebaseConfigured()) return;
    if (debouncRef.current) clearTimeout(debouncRef.current);
    debouncRef.current = setTimeout(() => {
      writePublicWalkStats({
        uid,
        user,
        shareWalkDistance: shareOnLeaderboard,
        walkTotals,
        level,
        achievementXp,
        achievementCount,
        achievementTotal: Array.isArray(lifeDefs) ? lifeDefs.length : 0,
        lifetimeKm: lifetimeStats?.km || 0,
        petName: primaryPetName,
        dailyDay: daily?.day,
        dailyDone: daily?.done,
      })
        .then(() => setLastSyncError(null))
        .catch((e) => setLastSyncError(e?.message || 'Sync failed'));
    }, 600);
    return () => {
      if (debouncRef.current) clearTimeout(debouncRef.current);
    };
  }, [
    uid,
    user,
    shareLoaded,
    shareOnLeaderboard,
    walkLog,
    walkTotals,
    daily,
    level,
    achievementXp,
    achievementCount,
    lifeDefs,
    lifetimeStats,
    primaryPetName,
  ]);

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
