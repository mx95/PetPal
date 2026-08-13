import { formatMaskedCard } from './startJccUpdateCard';

describe('formatMaskedCard', () => {
  it('shows last four digits for a JCC masked PAN', () => {
    expect(formatMaskedCard('411111******1111')).toBe('•••• 1111');
  });

  it('returns empty string when missing', () => {
    expect(formatMaskedCard('')).toBe('');
    expect(formatMaskedCard(null)).toBe('');
  });
});
