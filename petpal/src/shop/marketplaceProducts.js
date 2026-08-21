/** @typedef {{ id: string, title: string, companyName: string, description: string, priceCents: number, category: string, emoji: string }} MarketplaceProduct */

/**
 * Marketplace listings from registered companies.
 * Empty until real approved products are loaded from Firestore.
 */
export const MARKETPLACE_PRODUCTS = /** @type {MarketplaceProduct[]} */ ([]);
