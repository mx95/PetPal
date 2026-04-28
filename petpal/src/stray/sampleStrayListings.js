/**
 * Demo rows for the stray adoption board when Firestore has no open listings yet.
 * IDs must start with `sample_` — see {@link isSampleStrayListing}.
 */

/** @type {import('./strayTypes').StrayListing[]} */
export const SAMPLE_STRAY_LISTINGS = [
  {
    id: 'sample_rusty',
    reporterUid: '__demo__',
    categoryId: 'dog',
    nickname: 'Rusty',
    description:
      'Medium-sized mixed breed, rusty coat. Wearing a frayed blue collar, no tag. Friendly with people, cautious around loud traffic. Taken to a vet for a quick scan — no chip found.',
    foundWhere: 'Pedion tou Areos park, north entrance near café',
    foundWhenNote: 'Evening of the day before yesterday',
    contactPhone: '(demo — not real)',
    contactEmail: '',
    photoDataUrl: '',
    foundLat: 37.9944,
    foundLng: 23.7355,
    status: 'available',
    createdAt: '2026-04-20T14:30:00.000Z',
    updatedAt: '',
  },
  {
    id: 'sample_whiskers',
    reporterUid: '__demo__',
    categoryId: 'cat',
    nickname: 'Whiskers',
    description:
      'Adult tabby, green eyes, thin but alert. Meowing steadily when found. Kept in a quiet carrier overnight with water; seems litter-trained.',
    foundWhere: 'Residential alley off Ippokratous, rubbish bins area',
    foundWhenNote: 'Early morning',
    contactPhone: '(demo — not real)',
    contactEmail: 'demo.example@petpal.local',
    photoDataUrl: '',
    foundLat: 37.9838,
    foundLng: 23.7275,
    status: 'available',
    createdAt: '2026-04-22T09:15:00.000Z',
    updatedAt: '',
  },
  {
    id: 'sample_snowball',
    reporterUid: '__demo__',
    categoryId: 'rabbit',
    nickname: 'Snowball',
    description:
      'White dwarf rabbit, pink eyes. Very tame; may have escaped from a nearby balcony. No visible injuries.',
    foundWhere: 'Community garden behind the metro (planter boxes)',
    foundWhenNote: 'Weekend afternoon',
    contactPhone: '(demo — not real)',
    contactEmail: '',
    photoDataUrl: '',
    foundLat: 37.975,
    foundLng: 23.716,
    status: 'available',
    createdAt: '2026-04-24T11:00:00.000Z',
    updatedAt: '',
  },
];

/**
 * @param {string} [id]
 */
export function isSampleStrayListing(id) {
  return typeof id === 'string' && id.startsWith('sample_');
}
