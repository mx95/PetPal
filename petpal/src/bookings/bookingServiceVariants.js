/** @typedef {{ id: string, labelKey: string, durationMin: number, price?: string, descriptionKey?: string }} ServiceVariant */

export const DEFAULT_COAT_VARIANTS = [
  { id: 'short', labelKey: 'bookConfirm.coatShort', durationMin: 0, descriptionKey: 'bookConfirm.coatShortDesc' },
  { id: 'medium', labelKey: 'bookConfirm.coatMedium', durationMin: 0, descriptionKey: 'bookConfirm.coatMediumDesc' },
  { id: 'long', labelKey: 'bookConfirm.coatLong', durationMin: 0, descriptionKey: 'bookConfirm.coatLongDesc' },
];

const COAT_SERVICE_TYPES = new Set(['saloon', 'bath', 'grooming', 'groom']);

/** Grooming / bath services use coat-length variants. */
export function isCoatVariantService(service) {
  if (!service) return false;
  const type = String(service.type || '').toLowerCase();
  if (COAT_SERVICE_TYPES.has(type)) return true;
  return /groom|bath|salon|saloon|wash/i.test(String(service.name || ''));
}

function normalizeVariant(raw, baseDuration, basePrice) {
  const id = String(raw?.id || '').trim();
  if (!id) return null;
  const durationMin = Number.isFinite(Number(raw.durationMin))
    ? Math.max(5, Math.round(Number(raw.durationMin)))
    : Math.max(5, baseDuration);
  return {
    id,
    labelKey: raw.labelKey || `bookConfirm.coat_${id}`,
    descriptionKey: raw.descriptionKey || null,
    durationMin,
    price: raw.price != null && String(raw.price).trim() ? String(raw.price).trim() : basePrice,
  };
}

/** @returns {ServiceVariant[]} */
export function resolveServiceVariants(service) {
  if (!service) return [];
  const baseDuration = Math.max(5, Number(service.durationMin) || 30);
  const basePrice = service.price ? String(service.price) : '';

  if (Array.isArray(service.variants) && service.variants.length) {
    return service.variants
      .map((v) => normalizeVariant(v, baseDuration, basePrice))
      .filter(Boolean);
  }

  if (!isCoatVariantService(service)) return [];

  const offsets = { short: -15, medium: 0, long: 20 };
  return DEFAULT_COAT_VARIANTS.map((v) => {
    const durationMin = Math.max(15, baseDuration + (offsets[v.id] ?? 0));
    const price = basePrice;
    return { ...v, durationMin, price };
  });
}

export function resolveVariantById(service, variantId) {
  const variants = resolveServiceVariants(service);
  if (!variants.length) return null;
  return variants.find((v) => v.id === variantId) || variants[0];
}

export function resolveBookingDuration(service, variantId) {
  const variant = resolveVariantById(service, variantId);
  if (variant) return variant.durationMin;
  return Math.max(5, Number(service?.durationMin) || 30);
}

export function resolveBookingPrice(service, variantId) {
  const variant = resolveVariantById(service, variantId);
  if (variant?.price) return variant.price;
  return service?.price ? String(service.price) : '';
}

export function buildVariantSnapshot(service, variantId, t) {
  const variant = resolveVariantById(service, variantId);
  if (!variant) return null;
  return {
    id: variant.id,
    label: t(variant.labelKey),
    durationMin: variant.durationMin,
    price: variant.price || resolveBookingPrice(service, variant.id),
  };
}
