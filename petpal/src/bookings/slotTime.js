import { parseGeneratedSlotId } from './availability/slotId';

/** Resolve a bookable slot's start time from Firestore, rule-engine, or catalog shapes. */
export function slotStartDate(slot) {
  if (!slot) return null;

  if (slot.startAtMs != null) {
    const fromMs = new Date(Number(slot.startAtMs));
    if (!Number.isNaN(fromMs.getTime())) return fromMs;
  }

  const startAt = slot.startAt;
  if (startAt instanceof Date && !Number.isNaN(startAt.getTime())) return startAt;
  if (startAt?.toDate) {
    const fromTs = startAt.toDate();
    if (fromTs instanceof Date && !Number.isNaN(fromTs.getTime())) return fromTs;
  }

  if (slot.startAtIso) {
    const fromIso = new Date(slot.startAtIso);
    if (!Number.isNaN(fromIso.getTime())) return fromIso;
  }

  const parsed = parseGeneratedSlotId(slot.id);
  if (parsed?.startMs) {
    const fromId = new Date(parsed.startMs);
    if (!Number.isNaN(fromId.getTime())) return fromId;
  }

  return null;
}

export function slotEndDate(slot) {
  if (!slot) return null;

  if (slot.endAtMs != null) {
    const fromMs = new Date(Number(slot.endAtMs));
    if (!Number.isNaN(fromMs.getTime())) return fromMs;
  }

  const endAt = slot.endAt;
  if (endAt instanceof Date && !Number.isNaN(endAt.getTime())) return endAt;
  if (endAt?.toDate) {
    const fromTs = endAt.toDate();
    if (fromTs instanceof Date && !Number.isNaN(fromTs.getTime())) return fromTs;
  }

  if (slot.endAtIso) {
    const fromIso = new Date(slot.endAtIso);
    if (!Number.isNaN(fromIso.getTime())) return fromIso;
  }

  const start = slotStartDate(slot);
  const durationMin = Number(slot.durationMin);
  if (start && Number.isFinite(durationMin) && durationMin > 0) {
    return new Date(start.getTime() + durationMin * 60000);
  }

  return null;
}
