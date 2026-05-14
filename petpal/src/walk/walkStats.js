/**
 * Local-date walk distance helpers (per-calendar-day keys YYYY-MM-DD in local TZ).
 */

export function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday keys for the calendar week that contains `d` (local). */
export function currentWeekDayKeys(d = new Date()) {
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const t = new Date(monday);
    t.setDate(monday.getDate() + i);
    keys.push(localDayKey(t));
  }
  return keys;
}

function sumKeys(walkLog, keys) {
  if (!walkLog || typeof walkLog !== 'object') return 0;
  let s = 0;
  for (const k of keys) {
    const v = walkLog[k];
    if (v != null && Number.isFinite(Number(v))) s += Math.max(0, Number(v));
  }
  return s;
}

export function kmToday(walkLog, d = new Date()) {
  return sumKeys(walkLog, [localDayKey(d)]);
}

export function kmThisWeek(walkLog, d = new Date()) {
  return sumKeys(walkLog, currentWeekDayKeys(d));
}

export function kmThisYear(walkLog, d = new Date()) {
  if (!walkLog || typeof walkLog !== 'object') return 0;
  const y = d.getFullYear();
  const prefix = `${y}-`;
  let s = 0;
  for (const k of Object.keys(walkLog)) {
    if (typeof k === 'string' && k.startsWith(prefix)) {
      const v = walkLog[k];
      if (v != null && Number.isFinite(Number(v))) s += Math.max(0, Number(v));
    }
  }
  return s;
}

export function walkTotalsFromLog(walkLog) {
  const d = new Date();
  return {
    day: Math.round(kmToday(walkLog, d) * 100) / 100,
    week: Math.round(kmThisWeek(walkLog, d) * 100) / 100,
    year: Math.round(kmThisYear(walkLog, d) * 100) / 100,
  };
}

/** Consecutive local days (from today backward) with any logged walk distance. */
export function walkStreakDays(walkLog) {
  if (!walkLog || typeof walkLog !== 'object') return 0;
  let c = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = localDayKey(d);
    if ((Number(walkLog[k]) || 0) > 0) c += 1;
    else {
      if (i === 0) continue;
      break;
    }
  }
  return c;
}

/**
 * Km logged today for one pet from `walkSessions` (dayKey + optional petId).
 * Legacy sessions without `petId` still count when there is only one pet.
 * @param {unknown[]} walkSessions
 * @param {string} petId
 * @param {number} petsCount
 * @param {number} walkLogDayKm today's aggregate from walkLog (single-pet fallback)
 */
export function kmTodayForPetFromSessions(walkSessions, petId, petsCount, walkLogDayKm = 0) {
  const k = localDayKey();
  const pidNeed = petId != null ? String(petId).trim() : '';
  if (!pidNeed) return Math.round((Number(walkLogDayKm) || 0) * 100) / 100;
  if (!Array.isArray(walkSessions)) {
    return petsCount <= 1 ? Math.round((Number(walkLogDayKm) || 0) * 100) / 100 : 0;
  }
  let sum = 0;
  for (const s of walkSessions) {
    if (!s || typeof s !== 'object') continue;
    if (String(s.dayKey || '') !== k) continue;
    const sid = s.petId != null ? String(s.petId).trim() : '';
    if (petsCount <= 1) {
      if (!sid || sid === pidNeed) sum += Math.max(0, Number(s.km) || 0);
    } else if (sid === pidNeed) {
      sum += Math.max(0, Number(s.km) || 0);
    }
  }
  const rounded = Math.round(sum * 100) / 100;
  if (rounded === 0 && petsCount <= 1) {
    return Math.round((Number(walkLogDayKm) || 0) * 100) / 100;
  }
  return rounded;
}

/**
 * Most recent walk session relevant to this pet (same rules as kmTodayForPetFromSessions).
 */
export function latestWalkSessionForPet(walkSessions, petId, petsCount) {
  const pidNeed = petId != null ? String(petId).trim() : '';
  if (!pidNeed || !Array.isArray(walkSessions) || walkSessions.length === 0) return null;
  const sorted = [...walkSessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const s of sorted) {
    if (!s || typeof s !== 'object') continue;
    const sid = s.petId != null ? String(s.petId).trim() : '';
    if (petsCount <= 1) {
      if (!sid || sid === pidNeed) return s;
    } else if (sid === pidNeed) {
      return s;
    }
  }
  return null;
}
