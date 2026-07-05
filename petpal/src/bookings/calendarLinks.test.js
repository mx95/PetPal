import {
  buildCalendarEvent,
  buildIcsContent,
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

  test('googleCalendarUrl includes start and end stamps', () => {
    const event = buildCalendarEvent({
      serviceName: 'Grooming',
      petName: 'Odin',
      startAtIso: '2026-07-06T09:55:00.000Z',
      endAtIso: '2026-07-06T10:50:00.000Z',
    });
    const url = googleCalendarUrl(event);
    expect(url).toContain('calendar.google.com');
    expect(url).toContain('dates=20260706T095500Z%2F20260706T105000Z');
  });

  test('buildIcsContent includes DTSTART and DTEND', () => {
    const event = buildCalendarEvent({
      serviceName: 'Grooming',
      petName: 'Odin',
      startAtIso: '2026-07-06T09:55:00.000Z',
      durationMin: 55,
      providerAddress: '12 Makarios Ave, Limassol',
    });
    const ics = buildIcsContent(event);
    expect(ics).toContain('DTSTART:20260706T095500Z');
    expect(ics).toContain('DTEND:20260706T105000Z');
    expect(ics).toContain('LOCATION:12 Makarios Ave\\, Limassol');
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
});
