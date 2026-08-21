/**
 * Offline booking catalog — disabled for production listings.
 * Legacy provider/service ID aliases still resolve for old deep links.
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

/** Offline catalog providers — intentionally empty (no demo listings in Bookings). */
const CATALOG_PROVIDERS = {};
const CATALOG_SERVICES = {};
const CATALOG_SCHEDULES = {};

export function isCatalogProvider(providerId) {
  const id = resolveCatalogProviderId(providerId);
  return Boolean(CATALOG_PROVIDERS[id]);
}

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
