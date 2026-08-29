const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildInviteFromBooking, buildEventTitle, buildEventDetails } = require('./bookingCalendar');

test('buildEventTitle combines store, service, and pet', () => {
  assert.equal(
    buildEventTitle({ storeName: 'Happy Paws', serviceName: 'Grooming', petName: 'Odin' }),
    'Happy Paws — Grooming for Odin'
  );
});

test('buildEventDetails includes booking URL line', () => {
  const details = buildEventDetails({
    storeName: 'Happy Paws',
    serviceName: 'Grooming',
    petName: 'Odin',
    bookingId: 'bk_1',
    bookingUrl: 'https://petpal.com.cy/bookings/booking/bk_1',
    location: 'Limassol',
  });
  assert.match(details, /View booking: https:\/\/petpal\.com\.cy\/bookings\/booking\/bk_1/);
  assert.match(details, /Location: Limassol/);
});

test('buildInviteFromBooking emits METHOD:REQUEST ICS with alarm and URL', () => {
  const ics = buildInviteFromBooking({
    bookingId: 'bk_email_1',
    storeName: 'Happy Paws',
    serviceName: 'Grooming',
    petName: 'Odin',
    location: 'Limassol',
    startAt: '2026-08-29T11:30:00.000Z',
    endAt: '2026-08-29T12:30:00.000Z',
    attendeeEmail: 'owner@example.com',
    organizerEmail: 'bookings@petpal.com.cy',
  });
  assert.match(ics, /^BEGIN:VCALENDAR/);
  assert.match(ics, /METHOD:REQUEST/);
  assert.match(ics, /UID:bk_email_1@petpal\.com\.cy/);
  assert.match(ics, /URL:https:\/\/petpal\.com\.cy\/bookings\/booking\/bk_email_1/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /TRIGGER:-PT15M/);
  assert.match(ics, /ATTENDEE.*owner@example\.com/);
  assert.match(ics, /ORGANIZER.*bookings@petpal\.com\.cy/);
});

test('buildInviteFromBooking returns empty string without valid times', () => {
  assert.equal(buildInviteFromBooking({ bookingId: 'x', startAt: '', endAt: '' }), '');
});
