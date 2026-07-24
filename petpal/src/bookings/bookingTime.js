import { formatTime24 } from '../formatTime24';

export function bookingStartDate(booking) {
  if (!booking) return null;
  if (booking.startAt?.toDate) return booking.startAt.toDate();
  if (booking.startAt instanceof Date) return booking.startAt;
  if (booking.startAtMs) return new Date(booking.startAtMs);
  return null;
}

export function bookingEndDate(booking) {
  if (!booking) return null;
  if (booking.endAt?.toDate) return booking.endAt.toDate();
  if (booking.endAt instanceof Date) return booking.endAt;
  if (booking.endAtMs) return new Date(booking.endAtMs);
  const start = bookingStartDate(booking);
  const durationMin = Number(booking.serviceSnapshot?.durationMin);
  if (start && Number.isFinite(durationMin) && durationMin > 0) {
    return new Date(start.getTime() + durationMin * 60000);
  }
  return null;
}

/** @param {Date | null} start @param {Date | null} end */
export function formatBookingTimeRange(start, end) {
  if (!start) return '—';
  const startLabel = formatTime24(start);
  const endLabel = end ? formatTime24(end) : '—';
  return { startLabel, endLabel };
}

export function bookingStatusKey(status) {
  const s = String(status || 'booked').toLowerCase();
  if (s === 'completed') return 'providerPortal.statusCompleted';
  if (s === 'cancelled') return 'providerPortal.statusCancelled';
  if (s === 'booked') return 'providerPortal.statusBooked';
  return '';
}

export function bookingStatusLabel(status, t) {
  const s = String(status || 'booked').toLowerCase();
  const key = bookingStatusKey(s);
  if (key && typeof t === 'function') return t(key);
  if (s === 'completed') return 'Completed';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'booked') return 'Booked';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isBookingActionable(status) {
  const s = String(status || '').toLowerCase();
  return s !== 'completed' && s !== 'cancelled';
}
