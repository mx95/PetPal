/**
 * Booking density helpers and green → red heat styling for calendar day cells.
 */

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

export function weekDays(date) {
  const selected = startOfDay(date);
  const start = addDays(selected, -selected.getDay());
  return Array.from({ length: 7 }, (_, idx) => addDays(start, idx));
}

export function monthDays(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -first.getDay());
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
 * Maps booking count to a green → red heat color for calendar day cells.
 */
export function bookingHeatStyles(count, maxCount) {
  const n = Number(count) || 0;
  if (n <= 0) return undefined;

  const max = Math.max(1, Number(maxCount) || 1);
  const ratio = Math.min(1, n / max);
  const hue = Math.round(142 - ratio * 134);
  const sat = Math.round(52 + ratio * 28);
  const light = Math.round(90 - ratio * 22);
  const borderLight = Math.max(42, light - 14);
  const text = ratio >= 0.62 ? '#ffffff' : ratio >= 0.38 ? '#93370d' : '#027a48';

  return {
    background: `hsl(${hue} ${sat}% ${light}%)`,
    borderColor: `hsl(${hue} ${sat}% ${borderLight}%)`,
    color: text,
  };
}

export function BookingHeatLegend({ fewerLabel = 'Fewer', moreLabel = 'More' }) {
  return (
    <div className="pp-bookingHeatLegend" aria-hidden>
      <span className="pp-bookingHeatLegend__label">{fewerLabel}</span>
      <span className="pp-bookingHeatLegend__bar" />
      <span className="pp-bookingHeatLegend__label">{moreLabel}</span>
    </div>
  );
}
