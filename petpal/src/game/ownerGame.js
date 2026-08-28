/** Daily micro-missions: small XP, once per day per mission (client-only until backend). */

/** @type {Array<{ id: string, icon: string, xp: number, minWalkKmToday?: number, description?: string }>} */
export const DAILY_MISSIONS = [
  { id: 'check_in', icon: '☀️', xp: 4 },
  { id: 'hydration', icon: '💧', xp: 5 },
  { id: 'mini_walk', icon: '🚶', xp: 8 },
  {
    id: 'walk_5km',
    icon: '🗺️',
    xp: 22,
    minWalkKmToday: 5,
  },
  { id: 'treat', icon: '🦴', xp: 4 },
  { id: 'play', icon: '🎾', xp: 4 },
];

export function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Level 1 at 0 XP; each +100 XP bumps level (very gentle curve). */
export function xpToLevel(xp) {
  const n = Math.max(0, Math.floor(Number(xp) || 0));
  return 1 + Math.floor(n / 100);
}

export function xpInCurrentLevel(xp) {
  const n = Math.max(0, Math.floor(Number(xp) || 0));
  return n % 100;
}

export function xpToNextLevel(xp) {
  return 100;
}

const TRACK_ACH = [
  { key: 'first_fix', label: 'First live fix', desc: 'First GPS point for this pet.' },
  { key: 'week_online', label: 'Week online', desc: 'Device reporting 7 days.' },
  { key: 'fifty_refreshes', label: 'Keen viewer', desc: '50 live refreshes in a week.' },
];

const WALK_ACH = [
  { key: 'first_walk', label: 'First walk', desc: 'Log a first walk for this pet.' },
  { key: 'streak5', label: '5-day streak', desc: 'Walk 5 days in a row.' },
  { key: 'explorer', label: 'Explorer', desc: '3 new pet-friendly places.' },
];

export function trackingAchievementDefs() {
  return TRACK_ACH;
}

export function walkAchievementDefs() {
  return WALK_ACH;
}

/** Placeholder 0–1 progress per def key for UI */
export function petProgressPercent(petGame, track, key) {
  const t = petGame && petGame[track] && petGame[track][key];
  if (t == null) return 0;
  return Math.min(1, Math.max(0, t));
}

/* ------------------------------------------------------------------ */
/* Lifetime achievements                                              */
/* ------------------------------------------------------------------ */

/**
 * Lifetime achievement metric kinds. Each one has a deterministic
 * computation function over the saved game state.
 *
 * - distance: total km logged across walkLog
 * - walks:    number of walk sessions
 * - streak:   longest consecutive-day streak in walkLog
 * - level:    current caregiver level (xpToLevel(ownerXp))
 * - pets:     number of pets in pack
 * - photos:   total photos across all walk sessions
 * - peak:     best single-day km
 * - daily:    lifetime daily missions completed
 *
 * @typedef {'distance'|'walks'|'streak'|'level'|'pets'|'photos'|'peak'|'daily'} LifetimeKind
 *
 * @typedef {{
 *   id: string,
 *   kind: LifetimeKind,
 *   target: number,
 *   xp: number,
 *   tier: 'bronze'|'silver'|'gold'|'platinum'|'mythic'
 * }} LifetimeAchievementDef
 */

/** @type {LifetimeAchievementDef[]} */
export const LIFETIME_ACHIEVEMENTS = [
  // Distance — lifetime kilometers
  { id: 'dist_1', kind: 'distance', target: 1, xp: 10, tier: 'bronze' },
  { id: 'dist_5', kind: 'distance', target: 5, xp: 25, tier: 'bronze' },
  { id: 'dist_10', kind: 'distance', target: 10, xp: 40, tier: 'silver' },
  { id: 'dist_25', kind: 'distance', target: 25, xp: 60, tier: 'silver' },
  { id: 'dist_50', kind: 'distance', target: 50, xp: 90, tier: 'silver' },
  { id: 'dist_100', kind: 'distance', target: 100, xp: 130, tier: 'gold' },
  { id: 'dist_250', kind: 'distance', target: 250, xp: 200, tier: 'gold' },
  { id: 'dist_500', kind: 'distance', target: 500, xp: 280, tier: 'platinum' },
  { id: 'dist_1000', kind: 'distance', target: 1000, xp: 420, tier: 'platinum' },
  { id: 'dist_2500', kind: 'distance', target: 2500, xp: 700, tier: 'mythic' },

  // Walk count
  { id: 'walks_1', kind: 'walks', target: 1, xp: 10, tier: 'bronze' },
  { id: 'walks_5', kind: 'walks', target: 5, xp: 20, tier: 'bronze' },
  { id: 'walks_10', kind: 'walks', target: 10, xp: 35, tier: 'silver' },
  { id: 'walks_25', kind: 'walks', target: 25, xp: 60, tier: 'silver' },
  { id: 'walks_50', kind: 'walks', target: 50, xp: 90, tier: 'gold' },
  { id: 'walks_100', kind: 'walks', target: 100, xp: 140, tier: 'gold' },
  { id: 'walks_250', kind: 'walks', target: 250, xp: 220, tier: 'platinum' },
  { id: 'walks_500', kind: 'walks', target: 500, xp: 360, tier: 'mythic' },

  // Streak (longest consecutive walking days, ever)
  { id: 'streak_3', kind: 'streak', target: 3, xp: 25, tier: 'bronze' },
  { id: 'streak_7', kind: 'streak', target: 7, xp: 50, tier: 'silver' },
  { id: 'streak_14', kind: 'streak', target: 14, xp: 90, tier: 'silver' },
  { id: 'streak_30', kind: 'streak', target: 30, xp: 150, tier: 'gold' },
  { id: 'streak_60', kind: 'streak', target: 60, xp: 240, tier: 'platinum' },
  { id: 'streak_100', kind: 'streak', target: 100, xp: 360, tier: 'platinum' },
  { id: 'streak_365', kind: 'streak', target: 365, xp: 800, tier: 'mythic' },

  // Caregiver level milestones
  { id: 'level_2', kind: 'level', target: 2, xp: 10, tier: 'bronze' },
  { id: 'level_5', kind: 'level', target: 5, xp: 30, tier: 'bronze' },
  { id: 'level_10', kind: 'level', target: 10, xp: 60, tier: 'silver' },
  { id: 'level_25', kind: 'level', target: 25, xp: 150, tier: 'gold' },
  { id: 'level_50', kind: 'level', target: 50, xp: 320, tier: 'platinum' },
  { id: 'level_100', kind: 'level', target: 100, xp: 700, tier: 'mythic' },

  // Pets
  { id: 'pets_1', kind: 'pets', target: 1, xp: 15, tier: 'bronze' },
  { id: 'pets_3', kind: 'pets', target: 3, xp: 45, tier: 'silver' },
  { id: 'pets_5', kind: 'pets', target: 5, xp: 90, tier: 'gold' },

  // Photo memories
  { id: 'photos_1', kind: 'photos', target: 1, xp: 10, tier: 'bronze' },
  { id: 'photos_10', kind: 'photos', target: 10, xp: 30, tier: 'silver' },
  { id: 'photos_50', kind: 'photos', target: 50, xp: 80, tier: 'gold' },
  { id: 'photos_100', kind: 'photos', target: 100, xp: 150, tier: 'platinum' },

  // Peak-day kilometers (single best day)
  { id: 'peak_5', kind: 'peak', target: 5, xp: 30, tier: 'bronze' },
  { id: 'peak_10', kind: 'peak', target: 10, xp: 70, tier: 'silver' },
  { id: 'peak_15', kind: 'peak', target: 15, xp: 110, tier: 'gold' },
  { id: 'peak_20', kind: 'peak', target: 20, xp: 160, tier: 'platinum' },

  // Lifetime daily missions completed
  { id: 'daily_5', kind: 'daily', target: 5, xp: 15, tier: 'bronze' },
  { id: 'daily_25', kind: 'daily', target: 25, xp: 50, tier: 'silver' },
  { id: 'daily_100', kind: 'daily', target: 100, xp: 130, tier: 'gold' },
  { id: 'daily_500', kind: 'daily', target: 500, xp: 360, tier: 'mythic' },
];

export function lifetimeAchievementDefs() {
  return LIFETIME_ACHIEVEMENTS;
}

/** Sum of lifetime kilometers from a `walkLog` map of {day -> km}. */
export function lifetimeKm(walkLog) {
  if (!walkLog || typeof walkLog !== 'object') return 0;
  let s = 0;
  for (const k of Object.keys(walkLog)) {
    const v = Number(walkLog[k]);
    if (Number.isFinite(v) && v > 0) s += v;
  }
  return Math.round(s * 100) / 100;
}

/** Best single-day distance ever logged. */
export function bestSingleDayKm(walkLog) {
  if (!walkLog || typeof walkLog !== 'object') return 0;
  let m = 0;
  for (const k of Object.keys(walkLog)) {
    const v = Number(walkLog[k]);
    if (Number.isFinite(v) && v > m) m = v;
  }
  return Math.round(m * 100) / 100;
}

/** Total photos across all walk sessions. */
export function totalWalkPhotos(walkSessions) {
  if (!Array.isArray(walkSessions)) return 0;
  let n = 0;
  for (const s of walkSessions) {
    if (s && Array.isArray(s.photos)) n += s.photos.length;
  }
  return n;
}

/** Longest consecutive-day streak across the entire walkLog (any time, not just current). */
export function bestStreakDays(walkLog) {
  if (!walkLog || typeof walkLog !== 'object') return 0;
  const keys = Object.keys(walkLog)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Number(walkLog[k]) > 0)
    .sort();
  if (keys.length === 0) return 0;
  const dayMs = 24 * 60 * 60 * 1000;
  let best = 1;
  let cur = 1;
  let prev = new Date(`${keys[0]}T00:00:00`);
  for (let i = 1; i < keys.length; i++) {
    const d = new Date(`${keys[i]}T00:00:00`);
    const diff = Math.round((d.getTime() - prev.getTime()) / dayMs);
    if (diff === 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else if (diff > 1) {
      cur = 1;
    }
    prev = d;
  }
  return best;
}

/**
 * Compute a snapshot of every lifetime achievement against the supplied
 * derived inputs. Returns achievements augmented with `value`, `progress`
 * (clamped 0..1) and `earned`.
 *
 * @param {{
 *   walkLog?: Record<string, number>,
 *   walkSessions?: Array<{ photos?: string[] }>,
 *   level?: number,
 *   petsCount?: number,
 *   lifetimeDailyDone?: number,
 * }} input
 */
export function computeLifetimeAchievements(input) {
  const walkLog = input?.walkLog || {};
  const walkSessions = input?.walkSessions || [];
  const level = Math.max(1, Number(input?.level) || 1);
  const petsCount = Math.max(0, Number(input?.petsCount) || 0);
  const dailyDone = Math.max(0, Number(input?.lifetimeDailyDone) || 0);

  const km = lifetimeKm(walkLog);
  const walks = Array.isArray(walkSessions) ? walkSessions.length : 0;
  const photos = totalWalkPhotos(walkSessions);
  const peak = bestSingleDayKm(walkLog);
  const streak = bestStreakDays(walkLog);

  return LIFETIME_ACHIEVEMENTS.map((a) => {
    let value = 0;
    switch (a.kind) {
      case 'distance':
        value = km;
        break;
      case 'walks':
        value = walks;
        break;
      case 'streak':
        value = streak;
        break;
      case 'level':
        value = level;
        break;
      case 'pets':
        value = petsCount;
        break;
      case 'photos':
        value = photos;
        break;
      case 'peak':
        value = peak;
        break;
      case 'daily':
        value = dailyDone;
        break;
      default:
        value = 0;
    }
    const target = Math.max(1, Number(a.target) || 1);
    const progress = Math.min(1, Math.max(0, value / target));
    return {
      ...a,
      value: Math.round(value * 100) / 100,
      progress,
      earned: value >= target,
    };
  });
}

/** Derived totals for the Dashboard summary card. */
export function lifetimeStatsFromState({ walkLog, walkSessions, level, petsCount, lifetimeDailyDone }) {
  return {
    km: lifetimeKm(walkLog || {}),
    walks: Array.isArray(walkSessions) ? walkSessions.length : 0,
    photos: totalWalkPhotos(walkSessions || []),
    peakDay: bestSingleDayKm(walkLog || {}),
    bestStreak: bestStreakDays(walkLog || {}),
    level: Math.max(1, Number(level) || 1),
    petsCount: Math.max(0, Number(petsCount) || 0),
    dailyDone: Math.max(0, Number(lifetimeDailyDone) || 0),
  };
}
