import { computeAvailableSlots } from './availability/availabilityEngine';
import { dateKey, startOfDay } from './bookingHeatMap';

/**
 * Total bookable slots per calendar day from availability rules (all active services).
 * @returns {Map<string, number>} dateKey → slot count
 */
export function computeSlotCapacityByDay({
  settings,
  services = [],
  rules = [],
  overrides = [],
  vacations = [],
  blockedPeriods = [],
  rangeStart,
  rangeEnd,
}) {
  const map = new Map();
  const activeServices = (services || []).filter((s) => s.active !== false);
  if (!activeServices.length || !rules?.length) return map;

  const rangeStartDate = rangeStart instanceof Date ? rangeStart : startOfDay(new Date());
  const rangeEndDate = rangeEnd instanceof Date ? rangeEnd : rangeStartDate;

  activeServices.forEach((service) => {
    const slots = computeAvailableSlots({
      settings,
      service,
      serviceId: service.id,
      rules,
      overrides,
      vacations,
      blockedPeriods,
      bookings: [],
      rangeStart: rangeStartDate,
      rangeEnd: rangeEndDate,
    });
    slots.forEach((slot) => {
      const key = dateKey(new Date(slot.startAtMs));
      map.set(key, (map.get(key) || 0) + 1);
    });
  });

  return map;
}
