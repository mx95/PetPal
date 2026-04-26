import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from '../pets/PetsContext';
import {
  DAILY_MISSIONS,
  dayKey,
  petProgressPercent,
  trackingAchievementDefs,
  walkAchievementDefs,
  xpInCurrentLevel,
  xpToLevel,
  xpToNextLevel,
} from './ownerGame';
import { loadGameState, saveGameState } from './gameStorage';
import { localDayKey, walkTotalsFromLog } from '../walk/walkStats';

const GameContext = createContext(null);

function defaultState() {
  return {
    ownerXp: 0,
    daily: { day: dayKey(), done: [] },
    perPet: {},
    walkLog: {},
  };
}

function normalizeState(raw) {
  const b = defaultState();
  if (!raw || typeof raw !== 'object') return b;
  const today = dayKey();
  const d = raw.daily;
  let daily = b.daily;
  if (d && typeof d === 'object') {
    if (d.day === today) {
      daily = { day: today, done: Array.isArray(d.done) ? d.done : [] };
    } else {
      daily = { day: today, done: [] };
    }
  }
  const walkLog = raw.walkLog && typeof raw.walkLog === 'object' ? { ...raw.walkLog } : {};
  return {
    ownerXp: Math.max(0, Number(raw.ownerXp) || 0),
    daily,
    perPet: raw.perPet && typeof raw.perPet === 'object' ? raw.perPet : {},
    walkLog,
  };
}

export function GameProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { pets } = usePets();
  const [state, setState] = useState(defaultState);

  useEffect(() => {
    if (!uid) {
      setState(defaultState());
      return;
    }
    setState(normalizeState(loadGameState(uid)));
  }, [uid]);

  const persist = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (uid) saveGameState(uid, next);
        return next;
      });
    },
    [uid]
  );

  const completeDaily = useCallback(
    (missionId) => {
      const m = DAILY_MISSIONS.find((x) => x.id === missionId);
      if (!m) return false;
      let applied = false;
      persist((prev) => {
        const d = { ...prev.daily };
        const today = dayKey();
        if (d.day !== today) {
          d.day = today;
          d.done = [];
        }
        if (d.done.includes(missionId)) return prev;
        if (m.minWalkKmToday != null) {
          const dayKm = walkTotalsFromLog(prev.walkLog || {}).day;
          if (dayKm < m.minWalkKmToday) return prev;
        }
        applied = true;
        return {
          ...prev,
          ownerXp: prev.ownerXp + m.xp,
          daily: { day: today, done: [...d.done, missionId] },
        };
      });
      return applied;
    },
    [persist]
  );

  const setPetTrackProgress = useCallback(
    (petId, track, key, value01) => {
      persist((prev) => {
        const perPet = { ...prev.perPet };
        const petG = { ...(perPet[petId] || {}), [track]: { ...((perPet[petId] || {})[track] || {}), [key]: value01 } };
        perPet[petId] = petG;
        return { ...prev, perPet };
      });
    },
    [persist]
  );

  const addWalkKm = useCallback(
    (km) => {
      const n = Math.max(0, Number(km) || 0);
      if (n <= 0) return false;
      persist((prev) => {
        const k = localDayKey();
        const cur = (prev.walkLog && prev.walkLog[k]) || 0;
        const nextLog = { ...(prev.walkLog || {}), [k]: Math.round((cur + n) * 100) / 100 };
        return { ...prev, walkLog: nextLog };
      });
      return true;
    },
    [persist]
  );

  const walkTotals = useMemo(() => walkTotalsFromLog(state.walkLog), [state.walkLog]);

  const level = xpToLevel(state.ownerXp);
  const levelXp = xpInCurrentLevel(state.ownerXp);
  const nextMax = xpToNextLevel(state.ownerXp);

  const dailyDoneSet = useMemo(() => {
    const today = dayKey();
    if (state.daily.day !== today) return new Set();
    return new Set(state.daily.done);
  }, [state.daily]);

  const value = useMemo(
    () => ({
      ownerXp: state.ownerXp,
      level,
      levelXp,
      nextMax,
      completeDaily,
      DAILY_MISSIONS,
      dailyDone: dailyDoneSet,
      isDailyDone: (id) => dailyDoneSet.has(id),
      perPet: state.perPet,
      petProgressPercent: (petId, track, key) => petProgressPercent(state.perPet[petId], track, key),
      setPetTrackProgress,
      walkLog: state.walkLog,
      walkTotals,
      addWalkKm,
      trackingAchievementDefs: trackingAchievementDefs(),
      walkAchievementDefs: walkAchievementDefs(),
    }),
    [state, level, levelXp, nextMax, completeDaily, dailyDoneSet, setPetTrackProgress, walkTotals, addWalkKm]
  );

  // Ensure per-pet object exists for listed pets (UI only)
  useEffect(() => {
    if (!uid || !pets.length) return;
    setState((prev) => {
      let changed = false;
      const perPet = { ...prev.perPet };
      for (const p of pets) {
        if (!perPet[p.id]) {
          perPet[p.id] = { track: {}, walk: {} };
          changed = true;
        }
      }
      if (!changed) return prev;
      const next = { ...prev, perPet };
      saveGameState(uid, next);
      return next;
    });
  }, [uid, pets]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
