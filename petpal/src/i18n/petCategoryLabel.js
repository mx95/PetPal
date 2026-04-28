import { PET_CATEGORIES } from '../pets/petCategories';

/**
 * @param {(key: string) => string} t
 * @param {string | undefined} categoryId
 */
export function petCategoryLabel(t, categoryId) {
  const id = PET_CATEGORIES.some((c) => c.id === categoryId) ? /** @type {string} */ (categoryId) : 'other';
  const key = `categories.${id}`;
  const s = t(key);
  if (s !== key) return s;
  return PET_CATEGORIES.find((c) => c.id === id)?.label || 'Pet';
}
