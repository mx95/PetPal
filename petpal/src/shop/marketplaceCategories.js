/** Fixed marketplace product categories (Shop filters + product forms). */
export const MARKETPLACE_CATEGORIES = [
  { id: 'treats', emoji: '🐟' },
  { id: 'food', emoji: '🥣' },
  { id: 'toys', emoji: '🪢' },
  { id: 'grooming', emoji: '🪮' },
  { id: 'health', emoji: '💊' },
  { id: 'accessories', emoji: '🏠' },
];

export function isMarketplaceCategory(id) {
  return MARKETPLACE_CATEGORIES.some((c) => c.id === id);
}

export function marketplaceCategoryEmoji(id) {
  return MARKETPLACE_CATEGORIES.find((c) => c.id === id)?.emoji || '🛍️';
}
