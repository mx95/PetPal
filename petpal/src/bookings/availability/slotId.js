/** Virtual slot ids for dynamically generated availability (no Firestore slot doc). */

export const GENERATED_SLOT_PREFIX = 'gen_';

export function encodeGeneratedSlotId({ startMs, serviceId }) {
  return `${GENERATED_SLOT_PREFIX}${startMs}_${String(serviceId || '')}`;
}

export function parseGeneratedSlotId(slotId) {
  const raw = String(slotId || '');
  if (!raw.startsWith(GENERATED_SLOT_PREFIX)) return null;
  const body = raw.slice(GENERATED_SLOT_PREFIX.length);
  const sep = body.indexOf('_');
  if (sep <= 0) return null;
  const startMs = Number(body.slice(0, sep));
  const serviceId = body.slice(sep + 1);
  if (!Number.isFinite(startMs) || !serviceId) return null;
  return { startMs, serviceId };
}

export function isGeneratedSlotId(slotId) {
  return parseGeneratedSlotId(slotId) != null;
}

/** Build start/end for a rule-engine slot id without re-querying availability. */
export function resolveGeneratedSlotTimes(slotId, durationMin) {
  const generated = parseGeneratedSlotId(slotId);
  if (!generated) return null;
  const mins = Math.max(5, Number(durationMin) || 30);
  const start = new Date(generated.startMs);
  const end = new Date(generated.startMs + mins * 60000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { ...generated, start, end, durationMin: mins };
}
