import { slotStartDate } from './slotTime';

describe('slotStartDate', () => {
  test('reads plain Date startAt from rule-engine slots', () => {
    const start = new Date('2026-07-08T09:55:00.000Z');
    expect(slotStartDate({ id: 'gen_1_svc', startAt: start }).toISOString()).toBe(start.toISOString());
  });

  test('reads startAtMs', () => {
    const ms = Date.parse('2026-07-08T09:55:00.000Z');
    expect(slotStartDate({ id: 'x', startAtMs: ms }).toISOString()).toBe(new Date(ms).toISOString());
  });

  test('reads generated slot id', () => {
    const ms = Date.parse('2026-07-08T09:55:00.000Z');
    expect(slotStartDate({ id: `gen_${ms}_service1` }).toISOString()).toBe(new Date(ms).toISOString());
  });

  test('returns null for unknown slot shape', () => {
    expect(slotStartDate({ id: 'M22MJGHEVabc' })).toBeNull();
  });
});
