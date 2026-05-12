export const DEMO_PROVIDERS = [
  {
    id: 'example_vet',
    displayName: 'Paws & Care Vet Clinic',
    address: '123 Oak Street, Athens',
    phone: '+30 210 000 0000',
    providerTypes: { vet: true, saloon: false, hotel: false },
    rating: 4.8,
    priceTier: 2,
    lat: 37.9838,
    lng: 23.7275,
  },
  {
    id: 'example_groom',
    displayName: 'Fluffy Cuts Grooming & Pet Shop',
    address: '45 Sunset Ave, Kifisia',
    phone: '+30 210 111 1111',
    providerTypes: { vet: false, saloon: true, hotel: false },
    rating: 4.6,
    priceTier: 1,
    lat: 38.0744,
    lng: 23.8125,
  },
  {
    id: 'example_hotel',
    displayName: 'Snooze Inn Pet Hotel',
    address: '9 Marina Road, Glyfada',
    phone: '+30 210 222 2222',
    providerTypes: { vet: false, saloon: false, hotel: true },
    rating: 4.9,
    priceTier: 3,
    lat: 37.8616,
    lng: 23.7517,
  },
];

const DEMO_SERVICES = {
  example_vet: [
    { id: 'demo_vet_checkup', type: 'vet', name: 'Health checkup', durationMin: 30, description: 'General wellness exam', active: true },
    { id: 'demo_vet_vaccine', type: 'vet', name: 'Vaccination visit', durationMin: 20, description: 'Routine vaccine appointment', active: true },
  ],
  example_groom: [
    { id: 'demo_groom_basic', type: 'saloon', name: 'Bath & brush', durationMin: 45, description: 'Coat wash and brush-out', active: true },
    { id: 'demo_groom_full', type: 'saloon', name: 'Full grooming', durationMin: 90, description: 'Wash, trim, ears and nails', active: true },
  ],
  example_hotel: [
    { id: 'demo_hotel_daycare', type: 'hotel', name: 'Day care trial', durationMin: 240, description: 'Half-day care session', active: true },
    { id: 'demo_hotel_night', type: 'hotel', name: 'Overnight stay', durationMin: 720, description: 'One night boarding', active: true },
  ],
};

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function atTime(date, hour, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function asTimestampLike(date) {
  return {
    toDate: () => new Date(date),
    toMillis: () => new Date(date).getTime(),
  };
}

export function getDemoProvider(providerId) {
  return DEMO_PROVIDERS.find((p) => p.id === providerId) || null;
}

export function getDemoServices(providerId) {
  return (DEMO_SERVICES[providerId] || []).map((s) => ({ ...s }));
}

export function getDemoSlots(providerId, serviceId, { after = new Date() } = {}) {
  const service = getDemoServices(providerId).find((s) => s.id === serviceId);
  if (!service) return [];

  const start = new Date(after);
  const slots = [1, 2, 3, 4, 5].flatMap((dayOffset) => {
    const day = addDays(start, dayOffset);
    return [atTime(day, 10, 0), atTime(day, 14, 30)];
  });

  return slots
    .filter((slotStart) => slotStart >= after)
    .slice(0, 8)
    .map((slotStart, idx) => {
      const slotEnd = new Date(slotStart.getTime() + service.durationMin * 60 * 1000);
      return {
        id: `demo_slot_${providerId}_${serviceId}_${idx}`,
        serviceId,
        status: 'open',
        startAt: asTimestampLike(slotStart),
        endAt: asTimestampLike(slotEnd),
        startAtIso: slotStart.toISOString(),
        endAtIso: slotEnd.toISOString(),
      };
    });
}

