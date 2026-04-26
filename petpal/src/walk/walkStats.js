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
