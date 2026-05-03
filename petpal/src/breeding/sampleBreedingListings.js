/** @type {import('./breedingTypes').BreedingListing[]} */
export const SAMPLE_BREEDING_LISTINGS = [
  {
    id: 'sample_breed_1',
    ownerUid: '__demo__',
    dogName: 'Atlas',
    breedLabel: 'Hellenic Shepherd',
    gender: 'male',
    description:
      'Two years old, hips checked. Calm temperament, good with other dogs. Looking for responsibly planned litters.',
    locationText: 'Attica · willing to travel within Greece',
    linkedPetId: '',
    contactPhone: '(demo — not real)',
    contactEmail: 'demo.example@petpal.local',
    photoDataUrl: '',
    status: 'active',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '',
  },
  {
    id: 'sample_breed_2',
    ownerUid: '__demo__',
    dogName: 'Nefi',
    breedLabel: 'Labrador Retriever',
    gender: 'female',
    description:
      'Healthy three-year-old, full pedigree paperwork. Seeking compatible stud — preference for fox-red or yellow lines.',
    locationText: 'Thessaloniki area',
    linkedPetId: '',
    contactPhone: '(demo — not real)',
    contactEmail: '',
    photoDataUrl: '',
    status: 'active',
    createdAt: '2026-04-10T16:30:00.000Z',
    updatedAt: '',
  },
];

/**
 * @param {string} [id]
 */
export function isSampleBreedingListing(id) {
  return typeof id === 'string' && id.startsWith('sample_breed');
}
