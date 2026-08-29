function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function googleDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value.toDate) {
    const d = value.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
  bookingUrl,
  price,
  durationMin,
  customerEmail,
}) {
  const lines = [];
  if (storeName) lines.push(`Store: ${storeName}`);
  if (serviceName) lines.push(`Service: ${serviceName}`);
  if (variantLabel) lines.push(`Coat: ${variantLabel}`);
  if (petName) lines.push(`Pet: ${petName}`);
  if (customerEmail) lines.push(`Customer: ${customerEmail}`);
  if (Number.isFinite(durationMin) && durationMin > 0) lines.push(`Duration: ${durationMin} min`);
  if (price) lines.push(`Price: ${price}`);
  if (location) lines.push(`Location: ${location}`);
  if (bookingId) lines.push(`Confirmation: ${bookingId}`);
  if (bookingUrl) lines.push(`View booking: ${bookingUrl}`);
  lines.push('Booked via PetPal');
  return lines.join('\n');
}

function buildBookingDetailUrl(bookingId, origin = 'https://petpal.com.cy') {
  const id = String(bookingId || '').trim();
  if (!id) return '';
  return `${String(origin).replace(/\/$/, '')}/bookings/booking/${encodeURIComponent(id)}`;
}

function buildBookingIcs({
  uid,
  title,
  details,
  location,
  url,
  start,
  end,
  attendeeEmail,
  organizerEmail,
  organizerName = 'PetPal Bookings',
  alarmMinutes = 15,
}) {
  const startStamp = googleDate(start);
  const endStamp = googleDate(end);
  if (!startStamp || !endStamp) return '';

  const attendee = String(attendeeEmail || '').trim().toLowerCase();
  const organizer = String(organizerEmail || '').trim().toLowerCase();
  const mins = Number(alarmMinutes);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PetPal//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${googleDate(new Date())}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${escapeIcsText(title)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : '',
    url ? `URL:${escapeIcsText(url)}` : '',
    details ? `DESCRIPTION:${escapeIcsText(details)}` : '',
    organizer ? `ORGANIZER;CN=${escapeIcsText(organizerName)}:mailto:${organizer}` : '',
    attendee ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee}` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    Number.isFinite(mins) && mins > 0 ? 'BEGIN:VALARM' : '',
    Number.isFinite(mins) && mins > 0 ? `TRIGGER:-PT${mins}M` : '',
    Number.isFinite(mins) && mins > 0 ? 'ACTION:DISPLAY' : '',
    Number.isFinite(mins) && mins > 0 ? `DESCRIPTION:${escapeIcsText('PetPal appointment reminder')}` : '',
    Number.isFinite(mins) && mins > 0 ? 'END:VALARM' : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function buildInviteFromBooking({
  bookingId,
  storeName,
  serviceName,
  petName,
  variantLabel,
  location,
  price,
  durationMin,
  startAt,
  endAt,
  attendeeEmail,
  organizerEmail,
  customerEmail,
}) {
  const start = asDate(startAt);
  let end = asDate(endAt);
  const mins = Number(durationMin);
  if (start && !end && Number.isFinite(mins) && mins > 0) {
    end = new Date(start.getTime() + mins * 60000);
  }
  if (!start || !end) return '';

  const title = buildEventTitle({ storeName, serviceName, petName });
  const bookingUrl = buildBookingDetailUrl(bookingId);
  const details = buildEventDetails({
    storeName,
    serviceName,
    petName,
    variantLabel,
    location,
    bookingId,
    bookingUrl,
    price,
    durationMin: Number.isFinite(mins) && mins > 0 ? mins : undefined,
    customerEmail,
  });

  return buildBookingIcs({
    uid: `${bookingId || Date.now()}@petpal.com.cy`,
    title,
    details,
    location,
    url: bookingUrl,
    start,
    end,
    attendeeEmail,
    organizerEmail,
    organizerName: storeName || 'PetPal Bookings',
  });
}

module.exports = {
  buildInviteFromBooking,
  buildEventTitle,
  buildEventDetails,
};
