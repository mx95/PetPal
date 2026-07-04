/**
 * Maps booking count to a green → red heat color for calendar day cells.
 * @param {number} count — bookings on that day
 * @param {number} maxCount — busiest day in the visible period (month/week)
 * @returns {object|undefined} inline styles for the day button
 */
export function bookingHeatStyles(count, maxCount) {
  const n = Number(count) || 0;
  if (n <= 0) return undefined;

  const max = Math.max(1, Number(maxCount) || 1);
  const ratio = Math.min(1, n / max);
  const hue = Math.round(142 - ratio * 134);
  const sat = Math.round(52 + ratio * 28);
  const light = Math.round(90 - ratio * 22);
  const borderLight = Math.max(42, light - 14);
  const text = ratio >= 0.62 ? '#ffffff' : ratio >= 0.38 ? '#93370d' : '#027a48';

  return {
    background: `hsl(${hue} ${sat}% ${light}%)`,
    borderColor: `hsl(${hue} ${sat}% ${borderLight}%)`,
    color: text,
  };
}
