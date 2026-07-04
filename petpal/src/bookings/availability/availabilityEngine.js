/**
 * Rule-based availability engine — generates bookable slots on demand.
 * Priority (highest first): vacation → blocked → date override → bookings → service rule → weekly recurring.
 */

import { getPublicHolidays } from '../publicHolidays';
import {
  DEFAULT_TIMEZONE,
  eachYmdInRange,
  formatYmdInZone,
  localDateTimeToUtc,
  parseYmd,
} from './timezoneUtils';
import { encodeGeneratedSlotId } from './slotId';

export const HOLIDAY_MODES = {
  IGNORE: 'ignore',
  CLOSED: 'closed',
  CUSTOM: 'custom',
};

export const EFFECTIVE_MODES = {
  FOREVER: 'forever',
  UNTIL: 'until',
  RANGE: 'range',
};

export const DEFAULT_SCHEDULING_SETTINGS = {
  timezone: DEFAULT_TIMEZONE,
  useRuleEngine: true,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  advanceNoticeMin: 120,
  maxBookingDaysAhead: 90,
  holidayMode: HOLIDAY_MODES.CLOSED,
  holidayCountry: 'CY',
  slotStepMin: null,
};

function asMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (v?.toDate) return v.toDate().getTime();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function normalizePeriods(periods) {
  if (!Array.isArray(periods)) return [];
  return periods
    .map((p) => ({
      startTime: String(p?.startTime || p?.start || '').slice(0, 5),
      endTime: String(p?.endTime || p?.end || '').slice(0, 5),
    }))
    .filter((p) => p.startTime && p.endTime && p.endTime > p.startTime);
}

function ruleAppliesOnDate(rule, ymd, timeZone) {
  if (rule?.active === false) return false;
  const mode = rule.effectiveMode || EFFECTIVE_MODES.FOREVER;
  const from = rule.effectiveFrom || rule.startDate || null;
  const to = rule.effectiveTo || rule.endDate || null;
  if (mode === EFFECTIVE_MODES.UNTIL && to && ymd > to) return false;
  if (mode === EFFECTIVE_MODES.RANGE) {
    if (from && ymd < from) return false;
    if (to && ymd > to) return false;
  }
  if (mode === EFFECTIVE_MODES.FOREVER && from && ymd < from) return false;

  const date = parseYmd(ymd);
  if (!date) return false;

  if (rule.recurrenceType === 'monthly_exception') {
    return matchesMonthlyPattern(rule, ymd, timeZone);
  }

  const noon = localDateTimeToUtc(ymd, '12:00', timeZone);
  const zonedDow = noon ? new Date(noon).getUTCDay() : 0;
  const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
  const dayName = weekdayFmt.format(noon);
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = dowMap[dayName] ?? zonedDow;

  const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek.map(Number) : [];
  if (!days.length) return false;
  return days.includes(weekday);
}

function matchesMonthlyPattern(rule, ymd, timeZone) {
  const pattern = String(rule.monthlyPattern || '');
  const date = parseYmd(ymd);
  if (!date || !pattern) return false;
  const noon = localDateTimeToUtc(ymd, '12:00', timeZone);
  const dow = noon.getUTCDay();
  const targetDow = Number(rule.daysOfWeek?.[0]);
  if (!Number.isFinite(targetDow) || dow !== targetDow) return false;

  const firstOfMonth = `${date.year}-${String(date.month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(date.year, date.month, 0)).getUTCDate();

  if (pattern === 'first_weekday') {
    for (let d = 1; d <= 7; d += 1) {
      const key = `${date.year}-${String(date.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const n = localDateTimeToUtc(key, '12:00', timeZone);
      if (n.getUTCDay() === targetDow) return date.day === d;
    }
    return false;
  }

  if (pattern === 'last_weekday') {
    for (let d = daysInMonth; d >= daysInMonth - 6; d -= 1) {
      const key = `${date.year}-${String(date.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const n = localDateTimeToUtc(key, '12:00', timeZone);
      if (n.getUTCDay() === targetDow) return date.day === d;
    }
    return false;
  }

  return false;
}

function ruleSpecificity(rule) {
  let score = 0;
  if (rule.serviceId) score += 2;
  if (rule.employeeId) score += 4;
  return score;
}

function pickRulesForDay(rules, ctx) {
  const { ymd, serviceId, employeeId, timeZone } = ctx;
  const matching = (rules || [])
    .filter((r) => r.active !== false)
    .filter((r) => ruleAppliesOnDate(r, ymd, timeZone))
    .filter((r) => !r.serviceId || String(r.serviceId) === String(serviceId))
    .filter((r) => !r.employeeId || (employeeId && String(r.employeeId) === String(employeeId)));

  if (!matching.length) return [];

  const best = Math.max(...matching.map(ruleSpecificity));
  return matching.filter((r) => ruleSpecificity(r) === best);
}

function subtractBlocked(periodsMs, blockedRanges) {
  let result = periodsMs.slice();
  blockedRanges.forEach(([bStart, bEnd]) => {
    const next = [];
    result.forEach(([s, e]) => {
      if (!overlaps(s, e, bStart, bEnd)) {
        next.push([s, e]);
        return;
      }
      if (s < bStart) next.push([s, Math.max(s, bStart)]);
      if (e > bEnd) next.push([Math.min(e, bEnd), e]);
    });
    result = next.filter(([s, e]) => e > s);
  });
  return result;
}

function periodsForDay(ymd, rules, timeZone) {
  const periods = [];
  rules.forEach((rule) => {
    normalizePeriods(rule.periods).forEach((p) => {
      const start = localDateTimeToUtc(ymd, p.startTime, timeZone)?.getTime();
      const end = localDateTimeToUtc(ymd, p.endTime, timeZone)?.getTime();
      if (start != null && end != null && end > start) periods.push([start, end]);
    });
  });
  return periods;
}

function isOnVacation(ymd, vacations) {
  return (vacations || []).some((v) => {
    const from = String(v.startDate || v.start || '').slice(0, 10);
    const to = String(v.endDate || v.end || '').slice(0, 10);
    return from && to && ymd >= from && ymd <= to;
  });
}

function holidaySet(settings, year) {
  if (settings.holidayMode === HOLIDAY_MODES.IGNORE) return new Set();
  return new Set(getPublicHolidays(settings.holidayCountry || 'CY', year).map((h) => h.date));
}

function bookingRanges(bookings, bufferBefore, bufferAfter) {
  return (bookings || [])
    .filter((b) => String(b.status || '').toLowerCase() !== 'cancelled')
    .map((b) => {
      const start = asMs(b.startAt) ?? asMs(b.startAtMs);
      const end = asMs(b.endAt) ?? asMs(b.endAtMs) ?? start;
      if (start == null) return null;
      const safeEnd = end != null && end > start ? end : start + 30 * 60000;
      return [start - bufferBefore * 60000, safeEnd + bufferAfter * 60000];
    })
    .filter(Boolean);
}

function blockedForDay(ymd, blockedPeriods, timeZone, serviceId, employeeId) {
  const dayStart = localDateTimeToUtc(ymd, '00:00', timeZone)?.getTime();
  const dayEnd = localDateTimeToUtc(ymd, '23:59', timeZone)?.getTime() + 60000;
  if (dayStart == null || dayEnd == null) return [];

  return (blockedPeriods || [])
    .filter((b) => !b.serviceId || String(b.serviceId) === String(serviceId))
    .filter((b) => !b.employeeId || (employeeId && String(b.employeeId) === String(employeeId)))
    .map((b) => {
      const start = asMs(b.startAt) ?? asMs(b.startAtMs);
      const end = asMs(b.endAt) ?? asMs(b.endAtMs);
      if (start == null || end == null) return null;
      if (!overlaps(start, end, dayStart, dayEnd)) return null;
      return [Math.max(start, dayStart), Math.min(end, dayEnd)];
    })
    .filter(Boolean);
}

function overrideForDay(ymd, overrides, serviceId, employeeId) {
  const rows = (overrides || [])
    .filter((o) => String(o.date || '').slice(0, 10) === ymd)
    .filter((o) => !o.serviceId || String(o.serviceId) === String(serviceId))
    .filter((o) => !o.employeeId || (employeeId && String(o.employeeId) === String(employeeId)));
  if (!rows.length) return null;
  return rows[rows.length - 1];
}

function generateStartsFromWindows(windowsMs, durationMin, stepMin, nowMs) {
  const durationMs = Math.max(5, durationMin) * 60000;
  const step = Math.max(5, stepMin || durationMin) * 60000;
  const starts = [];

  windowsMs.forEach(([winStart, winEnd]) => {
    let cursor = winStart;
    while (cursor + durationMs <= winEnd) {
      if (cursor >= nowMs) starts.push(cursor);
      cursor += step;
    }
  });

  return starts;
}

/**
 * @param {object} input
 * @param {object} input.settings
 * @param {object} input.service — needs durationMin
 * @param {string} input.serviceId
 * @param {string} [input.employeeId]
 * @param {Array} input.rules
 * @param {Array} input.overrides
 * @param {Array} input.vacations
 * @param {Array} input.blockedPeriods
 * @param {Array} input.bookings
 * @param {Date} input.rangeStart
 * @param {Date} input.rangeEnd
 * @param {Date} [input.now]
 */
export function computeAvailableSlots(input) {
  const settings = { ...DEFAULT_SCHEDULING_SETTINGS, ...(input.settings || {}) };
  const timeZone = settings.timezone || DEFAULT_TIMEZONE;
  const now = input.now instanceof Date ? input.now : new Date();
  const nowMs = now.getTime();
  const advanceMs = (settings.advanceNoticeMin || 0) * 60000;
  const earliestMs = nowMs + advanceMs;
  const maxAheadMs = (settings.maxBookingDaysAhead || 90) * 86400000;
  const latestMs = nowMs + maxAheadMs;

  const service = input.service || {};
  const durationMin = Math.max(5, Number(input.durationMin) || Number(service.durationMin) || 30);
  const stepMin = settings.slotStepMin || durationMin;
  const serviceId = String(input.serviceId || service.id || '');
  const employeeId = input.employeeId ? String(input.employeeId) : null;

  const rangeStart = input.rangeStart instanceof Date ? input.rangeStart : now;
  const rangeEnd = input.rangeEnd instanceof Date ? input.rangeEnd : new Date(nowMs + 21 * 86400000);

  const fromYmd = formatYmdInZone(rangeStart, timeZone);
  const toYmd = formatYmdInZone(rangeEnd, timeZone);
  const bookingBlocks = bookingRanges(input.bookings, settings.bufferBeforeMin, settings.bufferAfterMin);

  const slots = [];
  const years = new Set([now.getUTCFullYear(), rangeEnd.getUTCFullYear()]);

  eachYmdInRange(fromYmd, toYmd, timeZone).forEach((ymd) => {
    const year = Number(ymd.slice(0, 4));
    years.add(year);

    if (isOnVacation(ymd, input.vacations)) return;

    const holidays = holidaySet(settings, year);
    if (settings.holidayMode === HOLIDAY_MODES.CLOSED && holidays.has(ymd)) return;

    const dayOverride = overrideForDay(ymd, input.overrides, serviceId, employeeId);
    if (dayOverride?.unavailable) return;

    let windowsMs;
    if (dayOverride && !dayOverride.unavailable) {
      windowsMs = periodsForDay(ymd, [{ periods: dayOverride.periods }], timeZone);
    } else {
      const weekly = pickRulesForDay(input.rules || [], { ymd, serviceId, employeeId, timeZone });
      windowsMs = periodsForDay(ymd, weekly, timeZone);
    }

    if (!windowsMs.length) return;

    const blocked = blockedForDay(ymd, input.blockedPeriods, timeZone, serviceId, employeeId);
    windowsMs = subtractBlocked(windowsMs, blocked);
    windowsMs = subtractBlocked(windowsMs, bookingBlocks);

    const starts = generateStartsFromWindows(windowsMs, durationMin, stepMin, earliestMs);
    starts.forEach((startMs) => {
      if (startMs > latestMs) return;
      const endMs = startMs + durationMin * 60000;
      if (bookingBlocks.some(([bS, bE]) => overlaps(startMs, endMs, bS, bE))) return;

      slots.push({
        id: encodeGeneratedSlotId({ startMs, serviceId }),
        serviceId,
        employeeId,
        status: 'open',
        startAtMs: startMs,
        endAtMs: endMs,
        generated: true,
      });
    });
  });

  slots.sort((a, b) => a.startAtMs - b.startAtMs);
  return slots;
}

/** Calendar preview markers for provider UI. */
export function buildCalendarPreview(input, { fromYmd, toYmd } = {}) {
  const settings = { ...DEFAULT_SCHEDULING_SETTINGS, ...(input.settings || {}) };
  const timeZone = settings.timezone || DEFAULT_TIMEZONE;
  const now = input.now instanceof Date ? input.now : new Date();
  const startYmd = fromYmd || formatYmdInZone(now, timeZone);
  const endYmd = toYmd || addDaysPreview(startYmd, 34, timeZone);

  const days = {};
  eachYmdInRange(startYmd, endYmd, timeZone).forEach((ymd) => {
    let status = 'closed';
    const year = Number(ymd.slice(0, 4));
    const holidays = holidaySet(settings, year);

    if (isOnVacation(ymd, input.vacations)) status = 'vacation';
    else if (settings.holidayMode === HOLIDAY_MODES.CLOSED && holidays.has(ymd)) status = 'holiday';
    else if (overrideForDay(ymd, input.overrides)) status = 'override';
    else {
      const weekly = pickRulesForDay(input.rules || [], { ymd, serviceId: null, employeeId: null, timeZone });
      if (weekly.length) status = 'working';
    }
    days[ymd] = status;
  });
  return days;
}

function addDaysPreview(ymd, days, timeZone) {
  const noon = localDateTimeToUtc(ymd, '12:00', timeZone);
  return formatYmdInZone(new Date(noon.getTime() + days * 86400000), timeZone);
}

export function slotToFirestoreShape(slot) {
  return {
    id: slot.id,
    serviceId: slot.serviceId,
    status: 'open',
    startAt: new Date(slot.startAtMs),
    endAt: new Date(slot.endAtMs),
    startAtMs: slot.startAtMs,
    endAtMs: slot.endAtMs,
    generated: true,
  };
}
