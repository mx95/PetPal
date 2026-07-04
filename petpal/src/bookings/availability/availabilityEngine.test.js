import { computeAvailableSlots, DEFAULT_SCHEDULING_SETTINGS } from './availabilityEngine';
import { encodeGeneratedSlotId } from './slotId';

const TZ = 'UTC';
const settings = { ...DEFAULT_SCHEDULING_SETTINGS, timezone: TZ, advanceNoticeMin: 0, holidayMode: 'ignore' };

function mondayRule(periods) {
  return {
    recurrenceType: 'weekly',
    daysOfWeek: [1],
    periods,
    active: true,
    effectiveMode: 'forever',
  };
}

test('generates slots from weekly schedule with service duration', () => {
  const monday = '2026-07-06';
  const slots = computeAvailableSlots({
    settings,
    service: { id: 'svc1', durationMin: 30 },
    serviceId: 'svc1',
    rules: [mondayRule([{ startTime: '09:00', endTime: '11:00' }])],
    overrides: [],
    vacations: [],
    blockedPeriods: [],
    bookings: [],
    rangeStart: new Date(`${monday}T00:00:00Z`),
    rangeEnd: new Date(`${monday}T23:59:59Z`),
    now: new Date(`${monday}T00:00:00Z`),
  });
  expect(slots.length).toBe(4);
  expect(slots[0].startAtMs).toBe(Date.parse('2026-07-06T09:00:00.000Z'));
});

test('supports multiple periods per day', () => {
  const monday = '2026-07-06';
  const slots = computeAvailableSlots({
    settings,
    service: { id: 'svc1', durationMin: 60 },
    serviceId: 'svc1',
    rules: [mondayRule([
      { startTime: '09:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '17:00' },
    ])],
    overrides: [],
    vacations: [],
    blockedPeriods: [],
    bookings: [],
    rangeStart: new Date(`${monday}T00:00:00Z`),
    rangeEnd: new Date(`${monday}T23:59:59Z`),
    now: new Date(`${monday}T00:00:00Z`),
  });
  expect(slots.length).toBe(6);
});

test('date override replaces recurring schedule', () => {
  const day = '2026-07-06';
  const slots = computeAvailableSlots({
    settings,
    service: { id: 'svc1', durationMin: 30 },
    serviceId: 'svc1',
    rules: [mondayRule([{ startTime: '09:00', endTime: '17:00' }])],
    overrides: [{ date: day, unavailable: false, periods: [{ startTime: '12:00', endTime: '13:00' }] }],
    vacations: [],
    blockedPeriods: [],
    bookings: [],
    rangeStart: new Date(`${day}T00:00:00Z`),
    rangeEnd: new Date(`${day}T23:59:59Z`),
    now: new Date(`${day}T00:00:00Z`),
  });
  expect(slots.length).toBe(2);
});

test('vacation blocks all slots', () => {
  const day = '2026-07-06';
  const slots = computeAvailableSlots({
    settings,
    service: { id: 'svc1', durationMin: 30 },
    serviceId: 'svc1',
    rules: [mondayRule([{ startTime: '09:00', endTime: '17:00' }])],
    overrides: [],
    vacations: [{ startDate: day, endDate: day }],
    blockedPeriods: [],
    bookings: [],
    rangeStart: new Date(`${day}T00:00:00Z`),
    rangeEnd: new Date(`${day}T23:59:59Z`),
    now: new Date(`${day}T00:00:00Z`),
  });
  expect(slots.length).toBe(0);
});

test('blocked period splits availability window', () => {
  const day = '2026-07-06';
  const slots = computeAvailableSlots({
    settings,
    service: { id: 'svc1', durationMin: 60 },
    serviceId: 'svc1',
    rules: [mondayRule([{ startTime: '09:00', endTime: '17:00' }])],
    overrides: [],
    vacations: [],
    blockedPeriods: [{
      startAt: new Date('2026-07-06T13:00:00.000Z'),
      endAt: new Date('2026-07-06T14:30:00.000Z'),
    }],
    bookings: [],
    rangeStart: new Date(`${day}T00:00:00Z`),
    rangeEnd: new Date(`${day}T23:59:59Z`),
    now: new Date(`${day}T00:00:00Z`),
  });
  const starts = slots.map((s) => new Date(s.startAtMs).toISOString());
  expect(starts).toContain('2026-07-06T09:00:00.000Z');
  expect(starts).toContain('2026-07-06T14:30:00.000Z');
  expect(starts).not.toContain('2026-07-06T13:00:00.000Z');
});

test('existing booking removes only overlapping slot', () => {
  const day = '2026-07-06';
  const slots = computeAvailableSlots({
    settings,
    service: { id: 'svc1', durationMin: 30 },
    serviceId: 'svc1',
    rules: [mondayRule([{ startTime: '09:00', endTime: '11:00' }])],
    overrides: [],
    vacations: [],
    blockedPeriods: [],
    bookings: [{
      status: 'booked',
      startAt: new Date('2026-07-06T10:30:00.000Z'),
      endAt: new Date('2026-07-06T11:00:00.000Z'),
    }],
    rangeStart: new Date(`${day}T00:00:00Z`),
    rangeEnd: new Date(`${day}T23:59:59Z`),
    now: new Date(`${day}T00:00:00Z`),
  });
  const starts = slots.map((s) => s.startAtMs);
  expect(starts).toContain(Date.parse('2026-07-06T09:00:00.000Z'));
  expect(starts).not.toContain(Date.parse('2026-07-06T10:30:00.000Z'));
});

test('generated slot ids are stable', () => {
  const id = encodeGeneratedSlotId({ startMs: 1000, serviceId: 'abc' });
  expect(id).toBe('gen_1000_abc');
});
