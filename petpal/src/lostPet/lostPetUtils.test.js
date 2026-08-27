import { filterActiveLostPetFeed, isActiveLostPetStatus, validateLostPetInput } from './lostPetUtils';

describe('lostPetUtils', () => {
  it('validates required lost pet fields', () => {
    expect(validateLostPetInput({ petId: '', description: 'x', lastSeenText: 'y', contactPhone: '1' })).toEqual({
      ok: false,
      code: 'pet',
    });
    expect(
      validateLostPetInput({
        petId: 'p1',
        description: 'desc',
        lastSeenText: 'park',
        contactPhone: '+35799123456',
      })
    ).toEqual({ ok: true });
  });

  it('filters active feed statuses', () => {
    const rows = [{ status: 'active' }, { status: 'found' }, { status: 'reported' }];
    expect(filterActiveLostPetFeed(rows)).toHaveLength(2);
  });

  it('detects active statuses', () => {
    expect(isActiveLostPetStatus('active')).toBe(true);
    expect(isActiveLostPetStatus('found')).toBe(false);
  });
});
