function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function googleDate(value) {
  return asDate(value)?.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') || '';
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function resolveEventTimes(event) {
  let start = asDate(event?.start);
  let end = asDate(event?.end);
  const durationMin = Number(event?.durationMin);

  if (start && !end && Number.isFinite(durationMin) && durationMin > 0) {
    end = new Date(start.getTime() + durationMin * 60000);
  }
  if (start && !end) {
    end = new Date(start.getTime() + 60 * 60000);
  }

  return { start, end };
}

export function buildCalendarEvent(booking) {
  const providerName = booking?.providerName || 'PetPal provider';
  const serviceName = booking?.serviceName || booking?.serviceSnapshot?.name || 'PetPal appointment';
  const petName = booking?.petName || booking?.petSnapshot?.name || 'your pet';
  const start = asDate(booking?.startAt) || asDate(booking?.startAtIso);
  const end = asDate(booking?.endAt) || asDate(booking?.endAtIso);
  const durationMin = Number(booking?.durationMin);

  let resolvedEnd = end;
  if (start && !resolvedEnd && Number.isFinite(durationMin) && durationMin > 0) {
    resolvedEnd = new Date(start.getTime() + durationMin * 60000);
  }

  return {
    title: `${serviceName} for ${petName}`,
    details: `PetPal booking${booking?.bookingId || booking?.id ? ` #${booking.bookingId || booking.id}` : ''}`,
    location: booking?.providerAddress || '',
    providerName,
    serviceName,
    petName,
    durationMin: Number.isFinite(durationMin) && durationMin > 0 ? durationMin : undefined,
    start,
    end: resolvedEnd,
  };
}

export function buildIcsContent(event) {
  const { start, end } = resolveEventTimes(event);
  const startStamp = googleDate(start);
  const endStamp = googleDate(end);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PetPal//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(16).slice(2)}@petpal.com.cy`,
    `DTSTAMP:${googleDate(new Date())}`,
    startStamp ? `DTSTART:${startStamp}` : '',
    endStamp ? `DTEND:${endStamp}` : '',
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : '',
    event.details ? `DESCRIPTION:${escapeIcsText(event.details)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function googleCalendarUrl(event) {
  const { start, end } = resolveEventTimes(event);
  const startStamp = googleDate(start);
  const endStamp = googleDate(end);
  if (!startStamp || !endStamp) return '';

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', event.title || 'PetPal appointment');
  url.searchParams.set('dates', `${startStamp}/${endStamp}`);
  if (event.details) url.searchParams.set('details', event.details);
  if (event.location) url.searchParams.set('location', event.location);
  return url.toString();
}

/** @deprecated Prefer downloadAppleCalendar — data URLs fail on many mobile browsers. */
export function appleCalendarDataUrl(event) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcsContent(event))}`;
}

export function openGoogleCalendar(event) {
  const url = googleCalendarUrl(event);
  if (!url) return false;
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.assign(url);
  return true;
}

export function downloadAppleCalendar(event, filename = 'petpal-booking.ics') {
  const ics = buildIcsContent(event);
  if (!ics.includes('DTSTART:')) return false;

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export function hasCalendarTimes(event) {
  const { start, end } = resolveEventTimes(event);
  return Boolean(start && end);
}
