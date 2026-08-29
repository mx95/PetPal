import {
  buildBookingDetailUrl,
  buildCalendarEvent,
  buildIcsContent,
  CALENDAR_DEFAULT_ALARM_MINUTES,
  downloadAppleCalendar,
  googleCalendarUrl,
  hasCalendarTimes,
} from './calendarLinks';

describe('calendarLinks', () => {
  test('buildCalendarEvent derives end from duration when end is missing', () => {
    const event = buildCalendarEvent({
      serviceName: 'Grooming',
      petName: 'Odin',
      startAtIso: '2026-07-06T09:55:00.000Z',
      durationMin: 55,
      bookingId: 'local_1',
    });
    expect(event.start).toBeInstanceOf(Date);
    expect(event.end).toBeInstanceOf(Date);
    expect(event.end.getTime() - event.start.getTime()).toBe(55 * 60000);
    expect(hasCalendarTimes(event)).toBe(true);
  });

  test('buildCalendarEvent includes store name and location', () => {
    const event = buildCalendarEvent({
      providerName: 'Sotiris Demo',
      serviceName: 'Full grooming',
      petName: 'Odin',
      providerAddress: 'Xylofagou',
      startAtIso: '2026-07-07T07:00:00.000Z',
      durationMin: 30,
      bookingId: 'abc123',
    });
    expect(event.title).toBe('Sotiris Demo — Full grooming for Odin');
    expect(event.location).toBe('Xylofagou');
    expect(event.details).toContain('Store: Sotiris Demo');
    expect(event.details).toContain('Location: Xylofagou');
    expect(event.details).toContain('Confirmation: abc123');
  });

  test('googleCalendarUrl includes start and end stamps', () => {
    const event = buildCalendarEvent({
      serviceName: 'Grooming',
      petName: 'Odin',
      startAtIso: '2026-07-06T09:55:00.000Z',
      endAtIso: '2026-07-06T10:50:00.000Z',
    });
    const url = googleCalendarUrl(event);
    expect(url).toContain('www.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('sf=true');
    expect(url).toContain('dates=20260706T095500Z%2F20260706T105000Z');
  });

  test('downloadAppleCalendar returns true when event has times', () => {
    const event = buildCalendarEvent({
      serviceName: 'Grooming',
      petName: 'Odin',
      startAtIso: '2026-07-06T09:55:00.000Z',
      durationMin: 30,
    });
    const createObjectURL = jest.fn(() => 'blob:ics');
    const revokeObjectURL = jest.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    expect(downloadAppleCalendar(event)).toBe(true);
    expect(createObjectURL).toHaveBeenCalled();

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  test('buildBookingDetailUrl builds absolute booking link', () => {
    expect(buildBookingDetailUrl('abc-123', 'https://petpal.com.cy')).toBe(
      'https://petpal.com.cy/bookings/booking/abc-123'
    );
    expect(buildBookingDetailUrl('abc-123')).toMatch(/\/bookings\/booking\/abc-123$/);
    expect(buildBookingDetailUrl('')).toBe('');
  });

  test('buildCalendarEvent includes booking URL in details and stable uid', () => {
    const event = buildCalendarEvent(
      {
        providerName: 'Happy Paws',
        serviceName: 'Grooming',
        petName: 'Odin',
        startAtIso: '2026-07-06T09:55:00.000Z',
        durationMin: 30,
        bookingId: 'bk_42',
      },
      (key) => key
    );
    expect(event.uid).toBe('bk_42@petpal.com.cy');
    expect(event.url).toContain('/bookings/booking/bk_42');
    expect(event.details).toContain('View booking:');
    expect(event.details).toContain('/bookings/booking/bk_42');
  });

  test('buildIcsContent includes DTSTART, DTEND, LOCATION, URL, VALARM, and stable UID', () => {
    const event = buildCalendarEvent({
      providerName: 'Sotiris Demo',
      serviceName: 'Grooming',
      petName: 'Odin',
      startAtIso: '2026-07-06T09:55:00.000Z',
      durationMin: 55,
      providerAddress: '12 Makarios Ave, Limassol',
      bookingId: 'bk_99',
    });
    const ics = buildIcsContent(event);
    expect(ics).toContain('UID:bk_99@petpal.com.cy');
    expect(ics).toContain('DTSTART:20260706T095500Z');
    expect(ics).toContain('DTEND:20260706T105000Z');
    expect(ics).toContain('LOCATION:12 Makarios Ave\\, Limassol');
    expect(ics).toContain('SUMMARY:Sotiris Demo');
    expect(ics).toContain('URL:');
    expect(ics).toContain('/bookings/booking/bk_99');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain(`TRIGGER:-PT${CALENDAR_DEFAULT_ALARM_MINUTES}M`);
    expect(ics).toContain('END:VALARM');
  });

  test('googleCalendarUrl includes details with booking link', () => {
    const event = buildCalendarEvent({
      serviceName: 'Grooming',
      petName: 'Odin',
      startAtIso: '2026-07-06T09:55:00.000Z',
      endAtIso: '2026-07-06T10:50:00.000Z',
      bookingId: 'bk_link',
    });
    const url = googleCalendarUrl(event);
    expect(url).toContain('details=');
    expect(url).toContain('View+booking');
    expect(url).toContain('bk_link');
  });

  test('hasCalendarTimes is false when start missing', () => {
    expect(hasCalendarTimes({ start: null, end: new Date() })).toBe(false);
  });
});
