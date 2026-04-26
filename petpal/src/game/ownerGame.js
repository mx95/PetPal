/** Daily micro-missions: small XP, once per day per mission (client-only until backend). */

export const DAILY_MISSIONS = [
  { id: 'check_in', label: 'Daily check-in', xp: 4 },
  { id: 'hydration', label: 'Water bowl refresh', xp: 5 },
  { id: 'mini_walk', label: '10-minute stroll', xp: 8 },
  { id: 'treat', label: 'Training / treat moment', xp: 4 },
  { id: 'play', label: 'Play or cuddle time', xp: 4 },
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
