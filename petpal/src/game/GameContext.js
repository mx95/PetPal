import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from '../pets/PetsContext';
import {
  DAILY_MISSIONS,
  computeLifetimeAchievements,
  dayKey,
  lifetimeAchievementDefs,
  lifetimeStatsFromState,
  petProgressPercent,
  trackingAchievementDefs,
  walkAchievementDefs,
  xpInCurrentLevel,
  xpToLevel,
  xpToNextLevel,
} from './ownerGame';
import { loadGameState, saveGameState } from './gameStorage';
import { localDayKey, walkTotalsFromLog } from '../walk/walkStats';
import { filesToResizedDataUrls, MAX_PHOTOS_PER_WALK_SESSION } from '../walk/walkPhotos';

const GameContext = createContext(null);

function newWalkSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `ws_${crypto.randomUUID()}`;
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultState() {
  return {
    ownerXp: 0,
    daily: { day: dayKey(), done: [] },
    lifetimeDailyDone: 0,
    perPet: {},
    walkLog: {},
    walkSessions: [],
    dismissedGpsWalkKeys: [],
  };
}

function normalizeWalkSessions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const id = s.id != null ? String(s.id) : newWalkSessionId();
      const dayKey = s.dayKey != null ? String(s.dayKey) : '';
      const km = Math.max(0, Number(s.km) || 0);
      const createdAt = s.createdAt != null ? String(s.createdAt) : new Date().toISOString();
      const photos = Array.isArray(s.photos) ? s.photos.filter((p) => typeof p === 'string' && p.startsWith('data:')) : [];
      const petId = s.petId != null ? String(s.petId).trim() : '';
      const source = s.source === 'gps' ? 'gps' : 'manual';
      const gpsKey = s.gpsKey != null ? String(s.gpsKey) : '';
      const startedAt = s.startedAt != null ? String(s.startedAt) : '';
      const endedAt = s.endedAt != null ? String(s.endedAt) : '';
      return {
        id,
        dayKey,
        km,
        createdAt,
        photos: photos.slice(0, MAX_PHOTOS_PER_WALK_SESSION),
        source,
        ...(petId ? { petId } : {}),
        ...(gpsKey ? { gpsKey } : {}),
        ...(startedAt ? { startedAt } : {}),
        ...(endedAt ? { endedAt } : {}),
      };
    })
    .filter(Boolean);
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
  const walkSessions = normalizeWalkSessions(raw.walkSessions);
  const dismissedGpsWalkKeys = Array.isArray(raw.dismissedGpsWalkKeys)
    ? raw.dismissedGpsWalkKeys.map((k) => String(k)).filter(Boolean).slice(-300)
    : [];
  return {
    ownerXp: Math.max(0, Number(raw.ownerXp) || 0),
    daily,
    lifetimeDailyDone: Math.max(0, Number(raw.lifetimeDailyDone) || 0),
    perPet: raw.perPet && typeof raw.perPet === 'object' ? raw.perPet : {},
    walkLog,
    walkSessions,
    dismissedGpsWalkKeys,
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
          lifetimeDailyDone: Math.max(0, Number(prev.lifetimeDailyDone) || 0) + 1,
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
    async (km, fileList, petId, options = {}) => {
      const n = Math.max(0, Number(km) || 0);
      if (n <= 0) return false;
      let photoUrls = [];
      if (fileList && fileList.length) {
        photoUrls = await filesToResizedDataUrls(Array.from(fileList));
        photoUrls = photoUrls.slice(0, MAX_PHOTOS_PER_WALK_SESSION);
      }
      const pid = petId != null ? String(petId).trim() : '';
      const source = options.source === 'gps' ? 'gps' : 'manual';
      const gpsKey = options.gpsKey != null ? String(options.gpsKey).trim() : '';
      const startedAt = options.startedAt != null ? String(options.startedAt) : '';
      const endedAt = options.endedAt != null ? String(options.endedAt) : '';
      persist((prev) => {
        const k = localDayKey();
        const cur = (prev.walkLog && prev.walkLog[k]) || 0;
        const nextLog = { ...(prev.walkLog || {}), [k]: Math.round((cur + n) * 100) / 100 };
        const sessions = Array.isArray(prev.walkSessions) ? [...prev.walkSessions] : [];
        const session = {
          id: newWalkSessionId(),
          dayKey: k,
          km: Math.round(n * 100) / 100,
          createdAt: new Date().toISOString(),
          photos: photoUrls,
          source,
          ...(pid ? { petId: pid } : {}),
          ...(gpsKey ? { gpsKey } : {}),
          ...(startedAt ? { startedAt } : {}),
          ...(endedAt ? { endedAt } : {}),
        };
        sessions.push(session);
        return { ...prev, walkLog: nextLog, walkSessions: sessions };
      });
      return true;
    },
    [persist]
  );

  const dismissSuggestedWalk = useCallback(
    (gpsKey) => {
      const key = String(gpsKey || '').trim();
      if (!key) return;
      persist((prev) => {
        const keys = Array.isArray(prev.dismissedGpsWalkKeys) ? [...prev.dismissedGpsWalkKeys] : [];
        if (keys.includes(key)) return prev;
        keys.push(key);
        return { ...prev, dismissedGpsWalkKeys: keys.slice(-300) };
      });
    },
    [persist]
  );

  const addPhotosToLatestWalk = useCallback(
    async (fileList) => {
      if (!fileList || !fileList.length) return { ok: false, reason: 'no_files' };
      const newUrls = await filesToResizedDataUrls(Array.from(fileList));
      if (!newUrls.length) return { ok: false, reason: 'no_images' };
      let out = { ok: false, reason: 'no_session' };
      persist((prev) => {
        const rawSessions = Array.isArray(prev.walkSessions) ? [...prev.walkSessions] : [];
        if (rawSessions.length === 0) {
          out = { ok: false, reason: 'no_session' };
          return prev;
        }
        const sorted = [...rawSessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latest = sorted[0];
        const idx = rawSessions.findIndex((s) => s.id === latest.id);
        if (idx < 0) {
          out = { ok: false, reason: 'no_session' };
          return prev;
        }
        const existing = rawSessions[idx].photos || [];
        const cap = Math.max(0, MAX_PHOTOS_PER_WALK_SESSION - existing.length);
        const add = newUrls.slice(0, cap);
        if (add.length === 0) {
          out = { ok: false, reason: 'max_photos' };
          return prev;
        }
        rawSessions[idx] = { ...rawSessions[idx], photos: [...existing, ...add] };
        out = { ok: true, added: add.length };
        return { ...prev, walkSessions: rawSessions };
      });
      return out;
    },
    [persist]
  );

  const removePhotoFromLatestWalk = useCallback(
    (photoIndex) => {
      persist((prev) => {
        const rawSessions = Array.isArray(prev.walkSessions) ? [...prev.walkSessions] : [];
        if (rawSessions.length === 0) return prev;
        const sorted = [...rawSessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const latest = sorted[0];
        const idx = rawSessions.findIndex((s) => s.id === latest.id);
        if (idx < 0) return prev;
        const photos = [...(rawSessions[idx].photos || [])];
        if (photoIndex < 0 || photoIndex >= photos.length) return prev;
        photos.splice(photoIndex, 1);
        rawSessions[idx] = { ...rawSessions[idx], photos };
        return { ...prev, walkSessions: rawSessions };
      });
    },
    [persist]
  );

  const walkTotals = useMemo(() => walkTotalsFromLog(state.walkLog), [state.walkLog]);

  const latestWalk = useMemo(() => {
    const s = state.walkSessions;
    if (!Array.isArray(s) || s.length === 0) return null;
    return [...s].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }, [state.walkSessions]);

  const level = xpToLevel(state.ownerXp);
  const levelXp = xpInCurrentLevel(state.ownerXp);
  const nextMax = xpToNextLevel(state.ownerXp);

  const dailyDoneSet = useMemo(() => {
    const today = dayKey();
    if (state.daily.day !== today) return new Set();
    return new Set(state.daily.done);
  }, [state.daily]);

  const lifetimeAchievements = useMemo(
    () =>
      computeLifetimeAchievements({
        walkLog: state.walkLog,
        walkSessions: state.walkSessions,
        level,
        petsCount: pets.length,
        lifetimeDailyDone: state.lifetimeDailyDone,
      }),
    [state.walkLog, state.walkSessions, state.lifetimeDailyDone, level, pets.length]
  );

  const achievementXp = useMemo(
    () => lifetimeAchievements.reduce((s, a) => s + (a.earned ? a.xp : 0), 0),
    [lifetimeAchievements]
  );
  const achievementCount = useMemo(
    () => lifetimeAchievements.reduce((c, a) => c + (a.earned ? 1 : 0), 0),
    [lifetimeAchievements]
  );

  const lifetimeStats = useMemo(
    () =>
      lifetimeStatsFromState({
        walkLog: state.walkLog,
        walkSessions: state.walkSessions,
        level,
        petsCount: pets.length,
        lifetimeDailyDone: state.lifetimeDailyDone,
      }),
    [state.walkLog, state.walkSessions, state.lifetimeDailyDone, level, pets.length]
  );

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
      lifetimeDailyDone: state.lifetimeDailyDone,
      perPet: state.perPet,
      petProgressPercent: (petId, track, key) => petProgressPercent(state.perPet[petId], track, key),
      setPetTrackProgress,
      walkLog: state.walkLog,
      walkSessions: state.walkSessions,
      dismissedGpsWalkKeys: state.dismissedGpsWalkKeys,
      walkTotals,
      latestWalk,
      addWalkKm,
      dismissSuggestedWalk,
      addPhotosToLatestWalk,
      removePhotoFromLatestWalk,
      trackingAchievementDefs: trackingAchievementDefs(),
      walkAchievementDefs: walkAchievementDefs(),
      lifetimeAchievementDefs: lifetimeAchievementDefs(),
      lifetimeAchievements,
      achievementXp,
      achievementCount,
      lifetimeStats,
    }),
    [
      state,
      level,
      levelXp,
      nextMax,
      completeDaily,
      dailyDoneSet,
      setPetTrackProgress,
      walkTotals,
      latestWalk,
      addWalkKm,
      dismissSuggestedWalk,
      addPhotosToLatestWalk,
      removePhotoFromLatestWalk,
      lifetimeAchievements,
      achievementXp,
      achievementCount,
      lifetimeStats,
    ]
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
