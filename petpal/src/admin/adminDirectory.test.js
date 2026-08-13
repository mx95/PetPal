import { filterAdminDirectory, mergeAdminDirectory, publicPetAbsoluteUrl, publicPetPath } from './adminDirectory';

describe('mergeAdminDirectory', () => {
  it('joins users, pets, and public IDs for NFC programming', () => {
    const users = mergeAdminDirectory({
      userDocs: [
        {
          id: 'u1',
          data: { email: 'ada@example.com', accountName: 'Ada', firstName: 'Ada', phone: '+35799111111' },
        },
        { id: 'u2', data: { email: 'bob@example.com', accountName: 'Bob' } },
      ],
      petDocs: [
        {
          id: 'pet1',
          ownerUid: 'u1',
          data: { name: 'Nala', publicProfileId: 'pub-nala', trackingDeviceId: '868022030670793', nfcTag: true },
        },
        { id: 'pet2', ownerUid: 'u2', data: { name: 'Rex' } },
      ],
      publicDocs: [
        { id: 'pub-nala', data: { ownerUid: 'u1', petId: 'pet1', name: 'Nala' } },
        { id: 'orphan-id', data: { ownerUid: 'u2', petId: 'pet2', name: 'Rex' } },
      ],
    });

    expect(users.map((u) => u.uid)).toEqual(['u1', 'u2']);
    const ada = users.find((u) => u.uid === 'u1');
    const bob = users.find((u) => u.uid === 'u2');
    expect(ada.email).toBe('ada@example.com');
    expect(ada.pets).toEqual([
      expect.objectContaining({
        id: 'pet1',
        name: 'Nala',
        publicId: 'pub-nala',
        imei: '868022030670793',
        nfcTag: true,
      }),
    ]);
    expect(bob.pets[0]).toEqual(
      expect.objectContaining({ id: 'pet2', name: 'Rex', publicId: 'orphan-id' })
    );
  });

  it('creates a user row from a public pet when the profile doc is missing', () => {
    const users = mergeAdminDirectory({
      publicDocs: [
        {
          id: 'nfc-abc',
          data: { ownerUid: 'ghost', petId: 'p9', name: 'Milo', ownerEmail: 'ghost@example.com', ownerName: 'Ghost' },
        },
      ],
    });
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual(
      expect.objectContaining({
        uid: 'ghost',
        email: 'ghost@example.com',
        name: 'Ghost',
        pets: [expect.objectContaining({ publicId: 'nfc-abc', name: 'Milo' })],
      })
    );
  });
});

describe('filterAdminDirectory', () => {
  const users = mergeAdminDirectory({
    userDocs: [{ id: 'u1', data: { email: 'ada@example.com', accountName: 'Ada' } }],
    petDocs: [{ id: 'pet1', ownerUid: 'u1', data: { name: 'Nala', publicProfileId: 'pub-nala' } }],
  });

  it('matches public id and pet name', () => {
    expect(filterAdminDirectory(users, 'PUB-NALA')).toHaveLength(1);
    expect(filterAdminDirectory(users, 'nala')).toHaveLength(1);
    expect(filterAdminDirectory(users, 'nobody')).toHaveLength(0);
  });
});

describe('public pet NFC urls', () => {
  it('builds relative and absolute /pet/:id links', () => {
    expect(publicPetPath('abc123')).toBe('/pet/abc123');
    expect(publicPetAbsoluteUrl('abc123', 'https://petpal.com.cy')).toBe('https://petpal.com.cy/pet/abc123');
    expect(publicPetPath('')).toBe('');
  });
});
