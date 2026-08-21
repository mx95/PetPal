/**
 * Bookable add-on services (multi-select in appointment wizard).
 */

import { resolveCatalogProviderId } from './bookingCatalog';

/** Offline catalog add-ons — empty while demo booking places are disabled. */
const CATALOG_ADDONS = {};

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
