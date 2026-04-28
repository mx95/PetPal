/** @typedef {{ id: string, label: string, emoji: string }} PetCategory */

/** @type {PetCategory[]} */
export const PET_CATEGORIES = [
  { id: 'dog', label: 'Dog', emoji: '🐕' },
  { id: 'cat', label: 'Cat', emoji: '🐈' },
  { id: 'rabbit', label: 'Rabbit', emoji: '🐰' },
  { id: 'bird', label: 'Bird', emoji: '🐦' },
  { id: 'reptile', label: 'Reptile / amphibian', emoji: '🦎' },
  { id: 'small', label: 'Small pet (hamster, etc.)', emoji: '🐹' },
  { id: 'other', label: 'Other', emoji: '🐾' },
];

const byId = Object.fromEntries(PET_CATEGORIES.map((c) => [c.id, c]));

export function getPetCategory(pet) {
  if (!pet?.categoryId) return byId.dog;
  return byId[pet.categoryId] || byId.other;
}

export function categoryEmoji(categoryId) {
  return (categoryId && byId[categoryId]?.emoji) || '🐾';
}
