import {
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
    variants: [
      { id: 'short', labelKey: 'bookConfirm.coatShort', durationMin: 60, price: '€38' },
      { id: 'medium', labelKey: 'bookConfirm.coatMedium', durationMin: 75, price: '€45' },
      { id: 'long', labelKey: 'bookConfirm.coatLong', durationMin: 95, price: '€55' },
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

  test('falls back to duration offsets when variants missing', () => {
    const svc = { type: 'bath', name: 'Bath', durationMin: 45 };
    const variants = resolveServiceVariants(svc);
    expect(variants.length).toBe(3);
    expect(resolveBookingDuration(svc, 'long')).toBeGreaterThan(resolveBookingDuration(svc, 'short'));
  });
});
