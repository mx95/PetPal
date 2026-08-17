import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
function str(v) {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

function userDisplayName(data) {
  return (
    str(data?.accountName) ||
    str(data?.displayName) ||
    [str(data?.firstName), str(data?.lastName)].filter(Boolean).join(' ') ||
    ''
  );
}

function emptyUser(uid, extras = {}) {
  return {
    uid,
    email: '',
    name: '',
    firstName: '',
    lastName: '',
    phone: '',
    accountType: '',
    pets: [],
    ...extras,
  };
}

/**
 * @param {{
 *   userDocs?: Array<{ id: string, data?: Record<string, unknown> }>,
 *   petDocs?: Array<{ id: string, ownerUid?: string, data?: Record<string, unknown> }>,
 *   publicDocs?: Array<{ id: string, data?: Record<string, unknown> }>,
 * }} input
 */
export function mergeAdminDirectory({ userDocs = [], petDocs = [], publicDocs = [] } = {}) {
  /** @type {Map<string, ReturnType<typeof emptyUser>>} */
  const usersByUid = new Map();

  for (const u of userDocs) {
    const data = u.data || {};
    usersByUid.set(u.id, emptyUser(u.id, {
      email: str(data.email),
      name: userDisplayName(data),
      firstName: str(data.firstName),
      lastName: str(data.lastName),
      phone: str(data.phone) || str(data.phoneNumber),
      accountType: str(data.accountType) || 'individual',
    }));
  }

  /** @type {Map<string, string>} */
  const publicByOwnerPet = new Map();
  const publicRows = [];

  for (const p of publicDocs) {
    const data = p.data || {};
    const ownerUid = str(data.ownerUid);
    const petId = str(data.petId);
    const row = {
      publicId: p.id,
      ownerUid,
      petId,
      name: str(data.name),
      ownerEmail: str(data.ownerEmail) || str(data.owner?.email),
      ownerName: str(data.ownerName) || str(data.owner?.name),
      ownerPhone: str(data.ownerPhone) || str(data.owner?.phone1),
    };
    publicRows.push(row);
    if (ownerUid && petId) publicByOwnerPet.set(`${ownerUid}:${petId}`, p.id);
    if (ownerUid && !usersByUid.has(ownerUid)) {
      usersByUid.set(ownerUid, emptyUser(ownerUid, {
        email: row.ownerEmail,
        name: row.ownerName,
        phone: row.ownerPhone,
        accountType: 'unknown',
      }));
    }
  }

  for (const pet of petDocs) {
    const ownerUid = str(pet.ownerUid);
    if (!ownerUid) continue;
    if (!usersByUid.has(ownerUid)) {
      usersByUid.set(ownerUid, emptyUser(ownerUid, { accountType: 'unknown' }));
    }
    const data = pet.data || {};
    const publicId = str(data.publicProfileId) || publicByOwnerPet.get(`${ownerUid}:${pet.id}`) || '';
    usersByUid.get(ownerUid).pets.push({
      id: pet.id,
      name: str(data.name) || 'Pet',
      breed: str(data.breed),
      categoryId: str(data.categoryId),
      publicId,
      imei: str(data.trackingDeviceId) || str(data.imei),
      nfcTag: Boolean(data.nfcTag),
    });
  }

  for (const pub of publicRows) {
    if (!pub.ownerUid) continue;
    const user = usersByUid.get(pub.ownerUid);
    if (!user) continue;
    const exists = user.pets.some((p) => p.id === pub.petId || (pub.publicId && p.publicId === pub.publicId));
    if (exists) continue;
    user.pets.push({
      id: pub.petId || pub.publicId,
      name: pub.name || 'Pet',
      breed: '',
      categoryId: '',
      publicId: pub.publicId,
      imei: '',
      nfcTag: true,
    });
  }

  for (const user of usersByUid.values()) {
    user.pets.sort((a, b) => a.name.localeCompare(b.name));
  }

  return Array.from(usersByUid.values()).sort((a, b) => {
    const an = (a.name || a.email || a.uid).toLowerCase();
    const bn = (b.name || b.email || b.uid).toLowerCase();
    return an.localeCompare(bn);
  });
}

export function filterAdminDirectory(users, queryText) {
  const needle = str(queryText).toLowerCase();
  if (!needle) return users;
  return users.filter((u) => {
    const hay = [
      u.uid,
      u.email,
      u.name,
      u.firstName,
      u.lastName,
      u.phone,
      u.accountType,
      ...u.pets.flatMap((p) => [p.name, p.publicId, p.imei, p.id, p.breed]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function publicPetPath(publicId) {
  const id = str(publicId);
  return id ? `/pet/${id}` : '';
}

export function publicPetAbsoluteUrl(publicId, origin = '') {
  const path = publicPetPath(publicId);
  if (!path) return '';
  const base = str(origin).replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

export async function fetchAdminUsersDirectory() {
  if (!isFirebaseConfigured()) return [];
  const db = getDb();
  const [usersSnap, publicSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'publicPets')),
  ]);

  const userDocs = usersSnap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  const publicDocs = publicSnap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));

  let petDocs = [];
  try {
    const petsSnap = await getDocs(collectionGroup(db, 'pets'));
    petDocs = petsSnap.docs.map((d) => ({
      id: d.id,
      ownerUid: d.ref.parent?.parent?.id || '',
      data: d.data() || {},
    }));
  } catch {
    const snaps = await Promise.all(
      usersSnap.docs.map((u) => getDocs(collection(db, 'users', u.id, 'pets')))
    );
    petDocs = snaps.flatMap((snap, i) =>
      snap.docs.map((d) => ({
        id: d.id,
        ownerUid: usersSnap.docs[i].id,
        data: d.data() || {},
      }))
    );
  }

  return mergeAdminDirectory({ userDocs, petDocs, publicDocs });
}
