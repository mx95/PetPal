import { slotEndDate, slotStartDate } from './slotTime';

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

function buildEventTitle({ storeName, serviceName, petName }) {
  const store = String(storeName || '').trim();
  const service = String(serviceName || '').trim() || 'PetPal appointment';
  const pet = String(petName || '').trim() || 'your pet';

  if (store && service && store.toLowerCase() !== service.toLowerCase()) {
    return `${store} — ${service} for ${pet}`;
  }
  if (store) return `${store} — ${pet}`;
  return `${service} for ${pet}`;
}

function buildEventDetails({
  storeName,
  serviceName,
  petName,
  variantLabel,
  location,
  bookingId,
  price,
  durationMin,
}) {
  const lines = [];
  if (storeName) lines.push(`Store: ${storeName}`);
  if (serviceName) lines.push(`Service: ${serviceName}`);
  if (variantLabel) lines.push(`Coat: ${variantLabel}`);
  if (petName) lines.push(`Pet: ${petName}`);
  if (Number.isFinite(durationMin) && durationMin > 0) lines.push(`Duration: ${durationMin} min`);
  if (price) lines.push(`Price: ${price}`);
  if (location) lines.push(`Location: ${location}`);
  if (bookingId) lines.push(`Confirmation: ${bookingId}`);
  lines.push('Booked via PetPal');
  return lines.join('\n');
}

export function buildCalendarEvent(booking) {
  const storeName = String(
    booking?.storeName || booking?.providerName || booking?.companyName || ''
  ).trim();
  const serviceName = String(booking?.serviceName || booking?.serviceSnapshot?.name || 'PetPal appointment').trim();
  const petName = String(booking?.petName || booking?.petSnapshot?.name || 'your pet').trim();
  const variantLabel = String(booking?.variantSnapshot?.label || '').trim();
  const location = String(booking?.providerAddress || booking?.address || booking?.location || '').trim();
  const bookingId = booking?.bookingId || booking?.id || '';
  const price = booking?.price || booking?.variantSnapshot?.price || booking?.serviceSnapshot?.price || '';
  const durationMin = Number(booking?.durationMin);

  const start = slotStartDate(booking);
  let end = slotEndDate(booking);
  if (start && !end && Number.isFinite(durationMin) && durationMin > 0) {
    end = new Date(start.getTime() + durationMin * 60000);
  }

  const title = buildEventTitle({ storeName, serviceName, petName });
  const details = buildEventDetails({
    storeName,
    serviceName,
    petName,
    variantLabel,
    location,
    bookingId,
    price,
    durationMin: Number.isFinite(durationMin) && durationMin > 0 ? durationMin : undefined,
  });

  return {
    title,
    details,
    location,
    storeName,
    providerName: storeName,
    serviceName,
    petName,
    durationMin: Number.isFinite(durationMin) && durationMin > 0 ? durationMin : undefined,
    start,
    end,
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

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', event.title || 'PetPal appointment');
  params.set('dates', `${startStamp}/${endStamp}`);
  params.set('sf', 'true');
  params.set('output', 'xml');
  if (event.details) params.set('details', event.details);
  if (event.location) params.set('location', event.location);
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

/** @deprecated Prefer native <a href> — see CalendarAddButtons. */
export function openGoogleCalendar(event) {
  const url = googleCalendarUrl(event);
  if (!url) return false;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

/** @deprecated Prefer downloadAppleCalendar — data URLs fail on many mobile browsers. */
export function appleCalendarDataUrl(event) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcsContent(event))}`;
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
