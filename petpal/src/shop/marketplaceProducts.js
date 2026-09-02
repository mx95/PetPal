import { BRAND } from '../config/brand';
import { SHOP_PRODUCTS, HARDWARE_SKUS, SHOP_PRODUCT_COPY_KEYS } from './catalog';

/** @typedef {{ id: string, shopSku: string, titleKey: string, descKey: string, priceCents: number, category: string, emoji: string, companyName: string }} MarketplaceProduct */

export const MARKETPLACE_SELLER = BRAND.productName;

/** PetPal Care Hub hardware — GPS tracker & NFC tags (subscriptions tab sells plans only). */
export const MARKETPLACE_PRODUCTS = /** @type {MarketplaceProduct[]} */ (
  SHOP_PRODUCTS.filter((p) => HARDWARE_SKUS.includes(p.id)).map((p) => ({
    id: p.id,
    shopSku: p.id,
    titleKey: SHOP_PRODUCT_COPY_KEYS[p.id]?.title || '',
    descKey: SHOP_PRODUCT_COPY_KEYS[p.id]?.subtitle || '',
    priceCents: p.amountCents,
    category: 'Hardware',
    emoji: p.id === 'TRACKER_HARDWARE' ? '📍' : '🏷️',
    companyName: BRAND.productName,
  }))
);
