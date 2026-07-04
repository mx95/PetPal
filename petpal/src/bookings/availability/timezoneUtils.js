/**
 * Timezone helpers without external deps. All persisted instants are UTC Date/ms.
 * Local wall-clock times are interpreted in the provider IANA timezone.
 */

export const DEFAULT_TIMEZONE = 'Europe/Nicosia';

export function parseYmd(ymd) {
  const [y, mo, d] = String(ymd || '').split('-').map(Number);
  if (!y || !mo || !d) return null;
  return { year: y, month: mo, day: d };
}

export function formatYmd(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function getZonedParts(date, timeZone = DEFAULT_TIMEZONE) {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const pick = (type) => parts.find((p) => p.type === type)?.value || '0';
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(pick('hour') === '24' ? '0' : pick('hour')),
    minute: Number(pick('minute')),
    second: Number(pick('second')),
  };
}

export function formatYmdInZone(date, timeZone = DEFAULT_TIMEZONE) {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Convert local wall time on a calendar day in `timeZone` to a UTC Date. */
export function localDateTimeToUtc(dateYmd, timeHHmm, timeZone = DEFAULT_TIMEZONE) {
  const ymd = parseYmd(dateYmd);
  if (!ymd) return null;
  const [hour, minute] = String(timeHHmm || '00:00').split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  let utcMs = Date.UTC(ymd.year, ymd.month - 1, ymd.day, hour, minute, 0);
  for (let i = 0; i < 5; i += 1) {
    const p = getZonedParts(new Date(utcMs), timeZone);
    const target = Date.UTC(ymd.year, ymd.month - 1, ymd.day, hour, minute, 0);
    const actual = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    utcMs += target - actual;
  }
  return new Date(utcMs);
}

export function addDaysUtc(ymd, days, timeZone = DEFAULT_TIMEZONE) {
  const start = localDateTimeToUtc(ymd, '12:00', timeZone);
  if (!start) return ymd;
  const next = new Date(start.getTime() + days * 86400000);
  return formatYmdInZone(next, timeZone);
}

export function eachYmdInRange(fromYmd, toYmd, timeZone = DEFAULT_TIMEZONE) {
  const keys = [];
  if (!fromYmd || !toYmd) return keys;
  let cursor = fromYmd;
  let guard = 0;
  while (cursor <= toYmd && guard < 400) {
    keys.push(cursor);
    cursor = addDaysUtc(cursor, 1, timeZone);
    guard += 1;
  }
  return keys;
}
