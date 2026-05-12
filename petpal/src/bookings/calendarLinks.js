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

function icsDate(value) {
  return googleDate(value);
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildCalendarEvent(booking) {
  const start = booking?.startAt || booking?.startAtIso;
  const end = booking?.endAt || booking?.endAtIso;
  const providerName = booking?.providerName || 'PetPal provider';
  const serviceName = booking?.serviceName || 'PetPal appointment';
  const petName = booking?.petName || booking?.petSnapshot?.name || 'your pet';

  return {
    title: `${serviceName} for ${petName}`,
    details: `PetPal booking${booking?.bookingId ? ` #${booking.bookingId}` : ''}`,
    location: booking?.providerAddress || '',
    providerName,
    serviceName,
    petName,
    start,
    end,
  };
}

export function googleCalendarUrl(event) {
  const start = googleDate(event.start);
  const end = googleDate(event.end);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', event.title);
  if (start && end) url.searchParams.set('dates', `${start}/${end}`);
  if (event.details) url.searchParams.set('details', event.details);
  if (event.location) url.searchParams.set('location', event.location);
  return url.toString();
}

export function appleCalendarDataUrl(event) {
  const start = icsDate(event.start);
  const end = icsDate(event.end);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PetPal//Bookings//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}-${Math.random().toString(16).slice(2)}@petpal`,
    `DTSTAMP:${icsDate(new Date())}`,
    start ? `DTSTART:${start}` : '',
    end ? `DTEND:${end}` : '',
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : '',
    event.details ? `DESCRIPTION:${escapeIcsText(event.details)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

