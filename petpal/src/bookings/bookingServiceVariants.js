/** @typedef {{ id: string, labelKey?: string, durationMin: number, price?: string, descriptionKey?: string, sizeId?: string, furId?: string }} ServiceVariant */

export const PET_SIZE_OPTIONS = [
  { id: 'small', labelKey: 'bookConfirm.sizeSmall', descriptionKey: 'bookConfirm.sizeSmallDesc' },
  { id: 'medium', labelKey: 'bookConfirm.sizeMedium', descriptionKey: 'bookConfirm.sizeMediumDesc' },
  { id: 'large', labelKey: 'bookConfirm.sizeLarge', descriptionKey: 'bookConfirm.sizeLargeDesc' },
];

export const FUR_LENGTH_OPTIONS = [
  { id: 'short', labelKey: 'bookConfirm.coatShort', descriptionKey: 'bookConfirm.coatShortDesc' },
  { id: 'medium', labelKey: 'bookConfirm.coatMedium', descriptionKey: 'bookConfirm.coatMediumDesc' },
  { id: 'long', labelKey: 'bookConfirm.coatLong', descriptionKey: 'bookConfirm.coatLongDesc' },
];

/** @deprecated use FUR_LENGTH_OPTIONS */
export const DEFAULT_COAT_VARIANTS = FUR_LENGTH_OPTIONS.map((o) => ({
  id: o.id,
  labelKey: o.labelKey,
  durationMin: 0,
  descriptionKey: o.descriptionKey,
}));

const COAT_SERVICE_TYPES = new Set(['saloon', 'bath', 'grooming', 'groom']);

const SIZE_DURATION_OFFSETS = { small: -10, medium: 0, large: 15 };
const FUR_DURATION_OFFSETS = { short: -10, medium: 0, long: 20 };

/** Grooming / bath services can use size / fur variants. */
export function isCoatVariantService(service) {
  if (!service) return false;
  const type = String(service.type || '').toLowerCase();
  if (COAT_SERVICE_TYPES.has(type)) return true;
  return /groom|bath|salon|saloon|wash/i.test(String(service.name || ''));
}

export function serviceAsksPetSize(service) {
  if (!service) return false;
  if (service.askPetSize === true) return true;
  return Array.isArray(service.variants) && service.variants.some((v) => v?.sizeId);
}

export function serviceAsksFurLength(service) {
  if (!service) return false;
  if (service.askFurLength === true) return true;
  if (!Array.isArray(service.variants) || !service.variants.length) return false;
  return service.variants.some((v) => {
    if (v?.furId) return true;
    const id = String(v?.id || '');
    return !v?.sizeId && (id === 'short' || id === 'medium' || id === 'long');
  });
}

/** Matrix key for a size/fur pair (or single dimension). */
export function durationMatrixKey(sizeId, furId) {
  if (sizeId && furId) return `${sizeId}-${furId}`;
  if (sizeId) return String(sizeId);
  if (furId) return String(furId);
  return '';
}

export function defaultDurationForSelection(baseDuration, sizeId, furId) {
  const base = Math.max(5, Number(baseDuration) || 30);
  const sizeOff = sizeId ? SIZE_DURATION_OFFSETS[sizeId] ?? 0 : 0;
  const furOff = furId ? FUR_DURATION_OFFSETS[furId] ?? 0 : 0;
  return Math.max(15, base + sizeOff + furOff);
}

/**
 * Build editable duration map defaults for the provider form.
 * @returns {Record<string, number>}
 */
export function buildDefaultDurationMatrix(baseDuration, askPetSize, askFurLength) {
  const map = {};
  const sizes = askPetSize ? PET_SIZE_OPTIONS : [null];
  const furs = askFurLength ? FUR_LENGTH_OPTIONS : [null];
  for (const size of sizes) {
    for (const fur of furs) {
      const sizeId = size?.id || '';
      const furId = fur?.id || '';
      const key = durationMatrixKey(sizeId, furId);
      if (!key) continue;
      map[key] = defaultDurationForSelection(baseDuration, sizeId || null, furId || null);
    }
  }
  return map;
}

/**
 * @param {{
 *   baseDuration: number,
 *   basePrice?: string,
 *   askPetSize: boolean,
 *   askFurLength: boolean,
 *   durationMatrix?: Record<string, number>,
 * }} opts
 * @returns {ServiceVariant[]}
 */
export function buildSizeFurVariants(opts) {
  const askPetSize = Boolean(opts.askPetSize);
  const askFurLength = Boolean(opts.askFurLength);
  if (!askPetSize && !askFurLength) return [];

  const baseDuration = Math.max(5, Number(opts.baseDuration) || 30);
  const basePrice = opts.basePrice ? String(opts.basePrice) : '';
  const matrix = opts.durationMatrix && typeof opts.durationMatrix === 'object' ? opts.durationMatrix : {};
  const sizes = askPetSize ? PET_SIZE_OPTIONS : [null];
  const furs = askFurLength ? FUR_LENGTH_OPTIONS : [null];
  /** @type {ServiceVariant[]} */
  const out = [];

  for (const size of sizes) {
    for (const fur of furs) {
      const sizeId = size?.id || '';
      const furId = fur?.id || '';
      const id = durationMatrixKey(sizeId, furId);
      if (!id) continue;
      const fromMatrix = Number(matrix[id]);
      const durationMin = Number.isFinite(fromMatrix) && fromMatrix >= 5
        ? Math.round(fromMatrix)
        : defaultDurationForSelection(baseDuration, sizeId || null, furId || null);
      out.push({
        id,
        sizeId: sizeId || undefined,
        furId: furId || undefined,
        labelKey: size && !fur ? size.labelKey : fur && !size ? fur.labelKey : '',
        descriptionKey: size && !fur ? size.descriptionKey : fur && !size ? fur.descriptionKey : undefined,
        durationMin,
        price: basePrice,
      });
    }
  }
  return out;
}

function normalizeVariant(raw, baseDuration, basePrice) {
  const id = String(raw?.id || '').trim();
  if (!id) return null;
  const durationMin = Number.isFinite(Number(raw.durationMin))
    ? Math.max(5, Math.round(Number(raw.durationMin)))
    : Math.max(5, baseDuration);
  const sizeId = raw.sizeId ? String(raw.sizeId).trim() : undefined;
  const furId = raw.furId ? String(raw.furId).trim() : undefined;
  return {
    id,
    labelKey: raw.labelKey ? String(raw.labelKey) : sizeId && !furId
      ? `bookConfirm.size${sizeId[0].toUpperCase()}${sizeId.slice(1)}`
      : furId && !sizeId
        ? `bookConfirm.coat${furId[0].toUpperCase()}${furId.slice(1)}`
        : '',
    descriptionKey: raw.descriptionKey || null,
    durationMin,
    price: raw.price != null && String(raw.price).trim() ? String(raw.price).trim() : basePrice,
    ...(sizeId ? { sizeId } : {}),
    ...(furId ? { furId } : {}),
  };
}

/**
 * Only returns variants when the business opted in (stored variants / ask flags).
 * No automatic coat options for bath/groom without opt-in.
 * @returns {ServiceVariant[]}
 */
export function resolveServiceVariants(service) {
  if (!service) return [];
  const baseDuration = Math.max(5, Number(service.durationMin) || 30);
  const basePrice = service.price ? String(service.price) : '';

  if (Array.isArray(service.variants) && service.variants.length) {
    return service.variants
      .map((v) => normalizeVariant(v, baseDuration, basePrice))
      .filter(Boolean);
  }

  const askPetSize = service.askPetSize === true;
  const askFurLength = service.askFurLength === true;
  if (!askPetSize && !askFurLength) return [];
  if (!isCoatVariantService(service) && !askPetSize && !askFurLength) return [];

  return buildSizeFurVariants({
    baseDuration,
    basePrice,
    askPetSize,
    askFurLength,
    durationMatrix: service.durationMatrix,
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

/** Human label for a variant using i18n `t`. */
export function formatVariantLabel(variant, t) {
  if (!variant) return '';
  if (variant.sizeId && variant.furId) {
    const size = PET_SIZE_OPTIONS.find((s) => s.id === variant.sizeId);
    const fur = FUR_LENGTH_OPTIONS.find((f) => f.id === variant.furId);
    const sizeLabel = size ? t(size.labelKey) : variant.sizeId;
    const furLabel = fur ? t(fur.labelKey) : variant.furId;
    return `${sizeLabel} · ${furLabel}`;
  }
  if (variant.labelKey) return t(variant.labelKey);
  if (variant.sizeId) {
    const size = PET_SIZE_OPTIONS.find((s) => s.id === variant.sizeId);
    return size ? t(size.labelKey) : variant.sizeId;
  }
  if (variant.furId) {
    const fur = FUR_LENGTH_OPTIONS.find((f) => f.id === variant.furId);
    return fur ? t(fur.labelKey) : variant.furId;
  }
  return variant.id;
}

export function buildVariantSnapshot(service, variantId, t) {
  const variant = resolveVariantById(service, variantId);
  if (!variant) return null;
  return {
    id: variant.id,
    label: formatVariantLabel(variant, t),
    durationMin: variant.durationMin,
    price: variant.price || resolveBookingPrice(service, variant.id),
    sizeId: variant.sizeId || null,
    furId: variant.furId || null,
  };
}
