/**
 * Booking density helpers and green → red heat styling for calendar day cells.
 */
import { useI18n } from '../i18n/I18nContext';

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Days since Monday (Mon=0 … Sun=6). */
export function daysFromMonday(date) {
  return (date.getDay() + 6) % 7;
}

export const WEEKDAY_LABELS_MON_START = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function weekDays(date) {
  const selected = startOfDay(date);
  const start = addDays(selected, -daysFromMonday(selected));
  return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
}

export function monthDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -daysFromMonday(first));
  return Array.from({ length: 42 }, (_, idx) => addDays(start, idx));
}

export function dateKey(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function bookingDate(booking) {
  if (!booking) return null;
  if (booking.startAt?.toDate) return booking.startAt.toDate();
  if (booking.startAt instanceof Date) return booking.startAt;
  if (booking.startAtMs) return new Date(booking.startAtMs);
  return null;
}

export function activeBookingsList(bookings) {
  return (bookings || []).filter((b) => String(b.status || '').toLowerCase() !== 'cancelled');
}

export function groupBookingsByDay(bookings) {
  const grouped = new Map();
  activeBookingsList(bookings).forEach((b) => {
    const d = bookingDate(b);
    if (!d) return;
    const key = dateKey(d);
    const rows = grouped.get(key) || [];
    rows.push(b);
    grouped.set(key, rows);
  });
  grouped.forEach((rows) => rows.sort((a, b) => (bookingDate(a)?.getTime() || 0) - (bookingDate(b)?.getTime() || 0)));
  return grouped;
}

export function maxBookingsInPeriod(bookingsByDay, { view, monthGrid, visibleMonth, weekRow, selectedKey }) {
  const keys =
    view === 'month'
      ? monthGrid
          .filter((day) => day.getMonth() === visibleMonth.getMonth())
          .map((day) => dateKey(day))
      : view === 'week'
        ? weekRow.map((day) => dateKey(day))
        : [selectedKey];
  let max = 0;
  keys.forEach((key) => {
    const count = (bookingsByDay.get(key) || []).length;
    if (count > max) max = count;
  });
  return max;
}

/**
 * Maps booked slots vs day capacity to heat color: green = fewer bookings, red = fuller day.
 * @param {number} bookedCount Active bookings on the day
 * @param {number} capacity Total bookable slots from availability rules
 */
export function bookingHeatStyles(bookedCount, capacity) {
  const capacityN = Math.max(0, Number(capacity) || 0);
  if (capacityN <= 0) return undefined;

  const booked = Math.max(0, Number(bookedCount) || 0);
  const ratio = Math.min(1, booked / capacityN);
  const hue = Math.round(142 - ratio * 134);
  const sat = Math.round(48 + ratio * 32);
  const light = Math.round(92 - ratio * 28);
  const borderLight = Math.max(38, light - 16);
  const text = ratio >= 0.55 ? '#ffffff' : ratio >= 0.3 ? '#93370d' : '#027a48';

  return {
    background: `hsl(${hue} ${sat}% ${light}%)`,
    borderColor: `hsl(${hue} ${sat}% ${borderLight}%)`,
    color: text,
  };
}

/** @deprecated Use capacity-based heat; kept for callers without scheduling rules. */
export function bookingHeatStylesFromMax(count, maxCount) {
  const n = Number(count) || 0;
  if (n <= 0) return undefined;
  return bookingHeatStyles(n, Math.max(1, Number(maxCount) || 1));
}

export function BookingHeatLegend({ fewerLabel, moreLabel }) {
  const { t } = useI18n();
  const fewer = fewerLabel || t('businessWeek.bookingHeatFewer');
  const more = moreLabel || t('businessWeek.bookingHeatMore');

  return (
    <div className="pp-bookingHeatLegend" aria-hidden>
      <span className="pp-bookingHeatLegend__label">{fewer}</span>
      <span className="pp-bookingHeatLegend__bar" />
      <span className="pp-bookingHeatLegend__label">{more}</span>
    </div>
  );
}
