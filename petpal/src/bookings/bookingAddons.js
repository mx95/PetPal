/**
 * Bookable add-on services (multi-select in appointment wizard).
 */

import { GROOMING_PROVIDER_ID, VET_PROVIDER_ID, resolveCatalogProviderId } from './bookingCatalog';

/** @type {Record<string, Array<{ id: string, nameKey: string, durationMin: number, price: string, emoji?: string }>>} */
const CATALOG_ADDONS = {
  [GROOMING_PROVIDER_ID]: [
    { id: 'bath', nameKey: 'bookConfirm.addonBath', durationMin: 25, price: '€18', emoji: '🛁' },
    { id: 'nail-cutting', nameKey: 'bookConfirm.addonNails', durationMin: 15, price: '€12', emoji: '✂️' },
    { id: 'brush-teeth', nameKey: 'bookConfirm.addonTeeth', durationMin: 10, price: '€8', emoji: '🦷' },
    { id: 'hair-cut', nameKey: 'bookConfirm.addonHaircut', durationMin: 35, price: '€22', emoji: '💇' },
    { id: 'tick-shampoo', nameKey: 'bookConfirm.addonTickShampoo', durationMin: 20, price: '€15', emoji: '🧴' },
  ],
  [VET_PROVIDER_ID]: [
    { id: 'nail-cutting', nameKey: 'bookConfirm.addonNails', durationMin: 15, price: '€12', emoji: '✂️' },
    { id: 'brush-teeth', nameKey: 'bookConfirm.addonTeeth', durationMin: 10, price: '€8', emoji: '🦷' },
  ],
};

export function getCatalogAddons(providerId) {
  const id = resolveCatalogProviderId(providerId);
  return (CATALOG_ADDONS[id] || []).map((a) => ({ ...a }));
}

export function resolveAddonsByIds(providerId, addonIds) {
  const set = new Set(Array.isArray(addonIds) ? addonIds : []);
  return getCatalogAddons(providerId).filter((a) => set.has(a.id));
}

function parseEuroPrice(value) {
  const n = parseFloat(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function sumAddonDuration(addons) {
  return (addons || []).reduce((sum, a) => sum + Math.max(0, Number(a.durationMin) || 0), 0);
}

export function formatCombinedPrice(...parts) {
  const total = parts.reduce((sum, p) => sum + parseEuroPrice(p), 0);
  return total > 0 ? `€${Math.round(total)}` : '';
}

export function buildAddonsSnapshot(addons, t) {
  return (addons || []).map((a) => ({
    id: a.id,
    name: t(a.nameKey),
    durationMin: a.durationMin,
    price: a.price,
  }));
}
