import {
  buildSizeFurVariants,
  isCoatVariantService,
  resolveBookingDuration,
  resolveServiceVariants,
  resolveVariantById,
} from './bookingServiceVariants';

describe('bookingServiceVariants', () => {
  const groomService = {
    type: 'saloon',
    name: 'Full grooming',
    durationMin: 75,
    price: '€45',
    askFurLength: true,
    variants: [
      { id: 'short', furId: 'short', labelKey: 'bookConfirm.coatShort', durationMin: 60, price: '€38' },
      { id: 'medium', furId: 'medium', labelKey: 'bookConfirm.coatMedium', durationMin: 75, price: '€45' },
      { id: 'long', furId: 'long', labelKey: 'bookConfirm.coatLong', durationMin: 95, price: '€55' },
    ],
  };

  test('detects grooming services for coat variants', () => {
    expect(isCoatVariantService(groomService)).toBe(true);
    expect(isCoatVariantService({ type: 'vet', name: 'Checkup' })).toBe(false);
  });

  test('resolves explicit variants from service', () => {
    const variants = resolveServiceVariants(groomService);
    expect(variants).toHaveLength(3);
    expect(resolveVariantById(groomService, 'long')?.durationMin).toBe(95);
  });

  test('does not invent coat options without business opt-in', () => {
    const svc = { type: 'bath', name: 'Bath', durationMin: 45 };
    expect(resolveServiceVariants(svc)).toEqual([]);
  });

  test('builds size × fur duration matrix when opted in', () => {
    const variants = buildSizeFurVariants({
      baseDuration: 45,
      askPetSize: true,
      askFurLength: true,
      durationMatrix: { 'large-long': 90, 'small-short': 25 },
    });
    expect(variants).toHaveLength(9);
    expect(variants.find((v) => v.id === 'large-long')?.durationMin).toBe(90);
    expect(variants.find((v) => v.id === 'small-short')?.durationMin).toBe(25);
  });

  test('size-only and fur-only matrices', () => {
    const sizeOnly = buildSizeFurVariants({ baseDuration: 40, askPetSize: true, askFurLength: false });
    expect(sizeOnly.map((v) => v.id)).toEqual(['small', 'medium', 'large']);
    const furOnly = buildSizeFurVariants({ baseDuration: 40, askPetSize: false, askFurLength: true });
    expect(furOnly.map((v) => v.id)).toEqual(['short', 'medium', 'long']);
    expect(resolveBookingDuration({ type: 'bath', durationMin: 40, variants: sizeOnly }, 'large')).toBeGreaterThan(
      resolveBookingDuration({ type: 'bath', durationMin: 40, variants: sizeOnly }, 'small')
    );
  });
});
