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
    workingHours: 'Mon–Sat 09:00–18:00 (closed Sun)',
    nextAvailable: 'Next slot 10:00',
  },
  {
    id: 'example_groom',
    displayName: 'Fluffy Cuts Grooming & Pet Shop',
    address: '45 Sunset Ave, Kifisia',
    phone: '+30 210 111 1111',
    providerTypes: { vet: false, bath: true, saloon: true, hotel: false },
    rating: 4.6,
    priceTier: 1,
    lat: 38.0744,
    lng: 23.8125,
    workingHours: 'Tue-Sat 10:00-19:00',
    nextAvailable: 'Bath slots today',
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
    workingHours: '24/7 boarding',
    nextAvailable: 'Tours this week',
  },
  {
    id: 'example_shop',
    displayName: 'TailWag Market Pet Shop',
    address: '18 Makariou Avenue, Nicosia',
    phone: '+357 22 000 001',
    providerTypes: { shop: true },
    rating: 4.7,
    lat: 35.1694,
    lng: 33.3665,
    workingHours: 'Mon-Sat 09:00-20:00',
    nextAvailable: 'Pickup consultations',
  },
  {
    id: 'example_daycare',
    displayName: 'Happy Paws Daycare',
    address: '7 Park Lane, Strovolos',
    phone: '+357 22 000 002',
    providerTypes: { daycare: true },
    rating: 4.8,
    lat: 35.1453,
    lng: 33.3557,
    workingHours: 'Mon-Fri 07:30-18:30',
    nextAvailable: 'Trial day tomorrow',
  },
  {
    id: 'example_cafe',
    displayName: 'Bark & Brew Pet Cafe',
    address: '4 Ledra Street, Nicosia',
    phone: '+357 22 000 003',
    providerTypes: { cafe: true },
    rating: 4.5,
    lat: 35.1738,
    lng: 33.3639,
    workingHours: 'Daily 08:00-22:00',
    nextAvailable: 'Event tables open',
  },
  {
    id: 'example_park',
    displayName: 'Green Leash Dog Park',
    address: 'Municipal Park, Engomi',
    phone: '+357 22 000 004',
    providerTypes: { park: true },
    rating: 4.6,
    lat: 35.1601,
    lng: 33.3214,
    workingHours: 'Daily 06:00-21:00',
    nextAvailable: 'Training slots weekend',
  },
];

/** @type {Record<string, { closedWeekdays: number[], windows: Array<{ start: [number, number], end: [number, number] }> }>} */
const DEMO_SCHEDULES = {
  example_vet: {
    closedWeekdays: [0],
    windows: [
      { start: [9, 0], end: [13, 0] },
      { start: [14, 0], end: [18, 0] },
    ],
  },
};

const DEMO_SERVICES = {
  example_vet: [
    { id: 'demo_vet_checkup', type: 'vet', name: 'Health checkup', durationMin: 30, description: 'General wellness exam', active: true },
    { id: 'demo_vet_vaccine', type: 'vet', name: 'Vaccination visit', durationMin: 20, description: 'Routine vaccine appointment', active: true },
  ],
  example_groom: [
    {
      id: 'demo_bath_basic',
      type: 'bath',
      name: 'Bath & brush',
      durationMin: 45,
      price: '€28',
      description: 'Coat wash and brush-out',
      active: true,
      variants: [
        { id: 'short', labelKey: 'bookConfirm.coatShort', durationMin: 35, price: '€24', descriptionKey: 'bookConfirm.coatShortDesc' },
        { id: 'medium', labelKey: 'bookConfirm.coatMedium', durationMin: 45, price: '€28', descriptionKey: 'bookConfirm.coatMediumDesc' },
        { id: 'long', labelKey: 'bookConfirm.coatLong', durationMin: 60, price: '€35', descriptionKey: 'bookConfirm.coatLongDesc' },
      ],
    },
    {
      id: 'demo_groom_full',
      type: 'saloon',
      name: 'Full grooming',
      durationMin: 75,
      price: '€45',
      description: 'Wash, trim, ears and nails',
      active: true,
      variants: [
        { id: 'short', labelKey: 'bookConfirm.coatShort', durationMin: 60, price: '€38', descriptionKey: 'bookConfirm.coatShortDesc' },
        { id: 'medium', labelKey: 'bookConfirm.coatMedium', durationMin: 75, price: '€45', descriptionKey: 'bookConfirm.coatMediumDesc' },
        { id: 'long', labelKey: 'bookConfirm.coatLong', durationMin: 95, price: '€55', descriptionKey: 'bookConfirm.coatLongDesc' },
      ],
    },
  ],
  example_hotel: [
    { id: 'demo_hotel_daycare', type: 'hotel', name: 'Day care trial', durationMin: 240, description: 'Half-day care session', active: true },
    { id: 'demo_hotel_night', type: 'hotel', name: 'Overnight stay', durationMin: 720, description: 'One night boarding', active: true },
  ],
  example_shop: [
    { id: 'demo_shop_food', type: 'shop', name: 'Nutrition consultation', durationMin: 30, description: 'Food, treats, and care product guidance', active: true },
    { id: 'demo_shop_pickup', type: 'shop', name: 'Click-and-collect fitting', durationMin: 20, description: 'Harness, collar, and essentials fitting', active: true },
  ],
  example_daycare: [
    { id: 'demo_daycare_trial', type: 'daycare', name: 'Daycare temperament trial', durationMin: 60, description: 'Meet the team and assess social comfort', active: true },
    { id: 'demo_daycare_half', type: 'daycare', name: 'Half-day daycare', durationMin: 240, description: 'Supervised play and rest session', active: true },
  ],
  example_cafe: [
    { id: 'demo_cafe_table', type: 'cafe', name: 'Pet-friendly table booking', durationMin: 90, description: 'Reserve a table with space for your pet', active: true },
    { id: 'demo_cafe_event', type: 'cafe', name: 'Puppy social event', durationMin: 120, description: 'Small social gathering for pets and owners', active: true },
  ],
  example_park: [
    { id: 'demo_park_training', type: 'park', name: 'Intro training session', durationMin: 45, description: 'Recall, leash manners, and park etiquette', active: true },
    { id: 'demo_park_social', type: 'park', name: 'Supervised social hour', durationMin: 60, description: 'Guided play group with a trainer', active: true },
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

export function getDemoBusinessAccounts() {
  return DEMO_PROVIDERS.map((provider) => ({
    ...provider,
    bookingEnabled: true,
    sponsored: provider.id === 'example_vet' || provider.id === 'example_groom',
    recommended: true,
    services: getDemoServices(provider.id),
    bookings: [
      {
        id: `${provider.id}_booking_1`,
        petName: 'Odin',
        ownerName: 'Sotiris',
        status: 'booked',
        serviceName: getDemoServices(provider.id)[0]?.name || 'Appointment',
        startAtLabel: 'Today, 10:00',
      },
      {
        id: `${provider.id}_booking_2`,
        petName: 'Adonis',
        ownerName: 'Maria',
        status: 'pending',
        serviceName: getDemoServices(provider.id)[1]?.name || 'Follow-up',
        startAtLabel: 'Tomorrow, 14:30',
      },
    ],
    clientPets: [
      { id: `${provider.id}_pet_odin`, name: 'Odin', ownerName: 'Sotiris', ownerPhone: '+357 99 111 222', trackingImei: '867488001234567' },
      { id: `${provider.id}_pet_luna`, name: 'Luna', ownerName: 'Maria', ownerPhone: '+357 99 333 444', trackingImei: '' },
    ],
  }));
}

export function getDemoBusinessAccount(providerId) {
  return getDemoBusinessAccounts().find((p) => p.id === providerId) || null;
}

export function getDemoSchedule(providerId) {
  return DEMO_SCHEDULES[providerId] || null;
}

export function isDemoClosedDay(providerId, date) {
  const schedule = getDemoSchedule(providerId);
  if (!schedule) return false;
  return schedule.closedWeekdays.includes(date.getDay());
}

/** First bookable YYYY-MM-DD on or after `fromDate` for demo providers with a schedule. */
export function nextOpenDemoDayYmd(providerId, fromDate = new Date()) {
  const base = new Date(fromDate);
  base.setHours(12, 0, 0, 0);
  if (!getDemoSchedule(providerId)) {
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
  }
  for (let i = 0; i < 14; i += 1) {
    const d = addDays(base, i);
    if (!isDemoClosedDay(providerId, d)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function collectDemoSlotStarts(providerId, service, after) {
  const schedule = getDemoSchedule(providerId);
  const durationMin = Math.max(5, Number(service.durationMin) || 30);
  const dayStart = new Date(after);
  dayStart.setHours(0, 0, 0, 0);

  const windows = schedule?.windows || [
    { start: [10, 0], end: [18, 0] },
  ];

  const starts = [];
  for (let dayOffset = 0; dayOffset < 21 && starts.length < 32; dayOffset += 1) {
    const day = addDays(dayStart, dayOffset);
    if (isDemoClosedDay(providerId, day)) continue;

    for (const win of windows) {
      let cursor = atTime(day, win.start[0], win.start[1]);
      const windowEnd = atTime(day, win.end[0], win.end[1]);
      while (cursor.getTime() + durationMin * 60 * 1000 <= windowEnd.getTime()) {
        if (cursor >= after) starts.push(new Date(cursor));
        cursor = new Date(cursor.getTime() + durationMin * 60 * 1000);
      }
    }
  }

  starts.sort((a, b) => a.getTime() - b.getTime());
  return starts;
}

export function getDemoSlots(providerId, serviceId, { after = new Date(), durationMin = null } = {}) {
  const service = getDemoServices(providerId).find((s) => s.id === serviceId);
  if (!service) return [];

  const effectiveDuration = Number.isFinite(Number(durationMin)) && Number(durationMin) > 0
    ? Number(durationMin)
    : Math.max(5, Number(service.durationMin) || 30);
  const serviceForSlots = { ...service, durationMin: effectiveDuration };
  const slotStarts = collectDemoSlotStarts(providerId, serviceForSlots, after).slice(0, 16);

  return slotStarts.map((slotStart, idx) => {
    const slotEnd = new Date(slotStart.getTime() + effectiveDuration * 60 * 1000);
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

