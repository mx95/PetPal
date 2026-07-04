import { bookingHeatStyles } from './bookingHeatMap';

describe('bookingHeatStyles', () => {
  test('returns green-ish style when few slots are booked', () => {
    const style = bookingHeatStyles(1, 12);
    expect(style).toBeDefined();
    expect(style.background).toMatch(/hsl\(13\d/);
  });

  test('returns red-ish style when all slots are booked', () => {
    const style = bookingHeatStyles(12, 12);
    expect(style).toBeDefined();
    expect(style.background).toMatch(/hsl\(8/);
  });

  test('shows empty-day green when capacity exists but nothing booked', () => {
    const style = bookingHeatStyles(0, 12);
    expect(style).toBeDefined();
    expect(style.color).toBe('#027a48');
  });

  test('returns undefined when day has no capacity', () => {
    expect(bookingHeatStyles(0, 0)).toBeUndefined();
    expect(bookingHeatStyles(3, 0)).toBeUndefined();
  });
});
