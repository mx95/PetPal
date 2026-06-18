/**
 * Offline grooming catalog — used when booking via direct URL before Firestore providers exist.
 * Provider and service IDs are stable public slugs (not "demo" / "example").
 */

export const GROOMING_PROVIDER_ID = 'fluffy-cuts-grooming';
export const VET_PROVIDER_ID = 'paws-care-vet-clinic';

export const GROOMING_SERVICES = {
  BATH: 'bath-brush',
  FULL: 'full-grooming',
};

export const VET_SERVICES = {
  CHECKUP: 'health-checkup',
  VACCINE: 'vaccination',
};

/** @deprecated Old URLs — resolved automatically in book flow */
export const LEGACY_PROVIDER_IDS = {
  example_groom: GROOMING_PROVIDER_ID,
  example_vet: VET_PROVIDER_ID,
};

export const LEGACY_SERVICE_IDS = {
  demo_bath_basic: GROOMING_SERVICES.BATH,
  demo_groom_full: GROOMING_SERVICES.FULL,
  demo_vet_checkup: VET_SERVICES.CHECKUP,
  demo_vet_vaccine: VET_SERVICES.VACCINE,
};

export function resolveCatalogProviderId(providerId) {
  const id = String(providerId || '').trim();
  return LEGACY_PROVIDER_IDS[id] || id;
}

export function resolveCatalogServiceId(serviceId) {
  const id = String(serviceId || '').trim();
  return LEGACY_SERVICE_IDS[id] || id;
}

export function isCatalogProvider(providerId) {
  const id = resolveCatalogProviderId(providerId);
  return Boolean(CATALOG_PROVIDERS[id]);
}

const GROOMING_PROVIDER = {
  id: GROOMING_PROVIDER_ID,
  displayName: 'Fluffy Cuts Grooming & Pet Shop',
  email: 'bookings@fluffycuts.petpal.app',
  address: '45 Sunset Ave, Kifisia',
  phone: '+30 210 111 1111',
  providerTypes: { vet: false, bath: true, saloon: true, hotel: false },
  rating: 4.6,
  priceTier: 1,
  lat: 38.0744,
  lng: 23.8125,
  workingHours: 'Tue–Sat 10:00–19:00',
  nextAvailable: 'Grooming slots this week',
  servicesPreview: 'Bath · Full grooming',
};

const VET_PROVIDER = {
  id: VET_PROVIDER_ID,
  displayName: 'Paws & Care Vet Clinic',
  email: 'appointments@paws-care.petpal.app',
  address: '12 Makarios Ave, Limassol',
  phone: '+357 25 000 000',
  providerTypes: { vet: true, bath: false, saloon: false, hotel: false },
  rating: 4.8,
  priceTier: 2,
  lat: 34.6841,
  lng: 33.0379,
  workingHours: 'Mon–Sat 09:00–18:00',
  nextAvailable: 'Next slot 10:00',
  servicesPreview: 'Checkups · Vaccinations',
  sponsored: true,
  recommended: true,
};

const CATALOG_PROVIDERS = {
  [GROOMING_PROVIDER_ID]: GROOMING_PROVIDER,
  [VET_PROVIDER_ID]: VET_PROVIDER,
};

const CATALOG_SERVICES = {
  [GROOMING_PROVIDER_ID]: [
    {
      id: GROOMING_SERVICES.BATH,
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
      id: GROOMING_SERVICES.FULL,
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
  [VET_PROVIDER_ID]: [
    {
      id: VET_SERVICES.CHECKUP,
      type: 'vet',
      name: 'Health checkup',
      durationMin: 30,
      price: '€35',
      description: 'General wellness exam',
      active: true,
    },
    {
      id: VET_SERVICES.VACCINE,
      type: 'vet',
      name: 'Vaccination visit',
      durationMin: 20,
      price: '€25',
      description: 'Routine vaccine appointment',
      active: true,
    },
  ],
};

const CATALOG_SCHEDULES = {
  [GROOMING_PROVIDER_ID]: {
    closedWeekdays: [0, 1],
    windows: [
      { start: [10, 0], end: [13, 0] },
      { start: [14, 0], end: [19, 0] },
    ],
  },
  [VET_PROVIDER_ID]: {
    closedWeekdays: [0],
    windows: [
      { start: [9, 0], end: [13, 0] },
      { start: [14, 0], end: [18, 0] },
    ],
  },
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

export function getCatalogProviders() {
  return Object.values(CATALOG_PROVIDERS).map((p) => ({ ...p }));
}

export function getCatalogProvider(providerId) {
  const id = resolveCatalogProviderId(providerId);
  const provider = CATALOG_PROVIDERS[id];
  return provider ? { ...provider } : null;
}

export function getCatalogServices(providerId) {
  const id = resolveCatalogProviderId(providerId);
  return (CATALOG_SERVICES[id] || []).map((s) => ({ ...s }));
}

export function getCatalogService(providerId, serviceId) {
  const sid = resolveCatalogServiceId(serviceId);
  return getCatalogServices(providerId).find((s) => s.id === sid) || null;
}

export function getCatalogSchedule(providerId) {
  const id = resolveCatalogProviderId(providerId);
  return CATALOG_SCHEDULES[id] || null;
}

export function isCatalogClosedDay(providerId, date) {
  const schedule = getCatalogSchedule(providerId);
  if (!schedule) return false;
  return schedule.closedWeekdays.includes(date.getDay());
}

export function nextOpenCatalogDayYmd(providerId, fromDate = new Date()) {
  const base = new Date(fromDate);
  base.setHours(12, 0, 0, 0);
  if (!getCatalogSchedule(providerId)) {
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
  }
  for (let i = 0; i < 14; i += 1) {
    const d = addDays(base, i);
    if (!isCatalogClosedDay(providerId, d)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function collectCatalogSlotStarts(providerId, service, after) {
  const schedule = getCatalogSchedule(providerId);
  const durationMin = Math.max(5, Number(service.durationMin) || 30);
  const dayStart = new Date(after);
  dayStart.setHours(0, 0, 0, 0);

  const windows = schedule?.windows || [{ start: [10, 0], end: [18, 0] }];
  const starts = [];

  for (let dayOffset = 0; dayOffset < 21 && starts.length < 32; dayOffset += 1) {
    const day = addDays(dayStart, dayOffset);
    if (isCatalogClosedDay(providerId, day)) continue;

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

export function getCatalogSlots(providerId, serviceId, { after = new Date(), durationMin = null } = {}) {
  const pid = resolveCatalogProviderId(providerId);
  const sid = resolveCatalogServiceId(serviceId);
  const service = getCatalogServices(pid).find((s) => s.id === sid);
  if (!service) return [];

  const effectiveDuration =
    Number.isFinite(Number(durationMin)) && Number(durationMin) > 0
      ? Number(durationMin)
      : Math.max(5, Number(service.durationMin) || 30);
  const serviceForSlots = { ...service, durationMin: effectiveDuration };
  const slotStarts = collectCatalogSlotStarts(pid, serviceForSlots, after).slice(0, 16);

  return slotStarts.map((slotStart, idx) => {
    const slotEnd = new Date(slotStart.getTime() + effectiveDuration * 60 * 1000);
    return {
      id: `slot_${pid}_${sid}_${idx}`,
      serviceId: sid,
      status: 'open',
      startAt: asTimestampLike(slotStart),
      endAt: asTimestampLike(slotEnd),
      startAtIso: slotStart.toISOString(),
      endAtIso: slotEnd.toISOString(),
    };
  });
}

export const LOCAL_BOOKINGS_KEY = 'petpal_bookings_v1';
