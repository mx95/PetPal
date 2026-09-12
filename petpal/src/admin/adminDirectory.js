import { collection, collectionGroup, getDocs } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

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
    accountType: 'individual',
    profileKind: '',
    profileName: '',
    profileStatus: '',
    profileId: '',
    pets: [],
    subscriptions: [],
    ...extras,
  };
}

function tsToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return null;
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} id
 * @param {string} [ownerUid]
 */
function mapSubscriptionRow(data, id, ownerUid = '') {
  const paymentId =
    str(data.paymentId) ||
    str(data.createdFromOrderNumber) ||
    str(data.orderNumber) ||
    '';
  const nextMs = tsToMillis(data.nextRenewalAt);
  return {
    id: str(id),
    uid: str(data.uid) || str(ownerUid),
    paymentId,
    subscriptionId: str(data.subscriptionId) || str(id),
    sku: str(data.sku) || 'PETPAL_PLUS_MONTHLY',
    status: str(data.status) || 'active',
    trackerImei: str(data.trackerImei) || str(data.imei),
    nextRenewalAtMs: nextMs,
  };
}

/**
 * @param {{
 *   userDocs?: Array<{ id: string, data?: Record<string, unknown> }>,
 *   petDocs?: Array<{ id: string, ownerUid?: string, data?: Record<string, unknown> }>,
 *   publicDocs?: Array<{ id: string, data?: Record<string, unknown> }>,
 *   companyDocs?: Array<{ id: string, ownerUid?: string, businessName?: string, status?: string, [key: string]: unknown }>,
 *   shelterDocs?: Array<{ id: string, ownerUid?: string, shelterName?: string, status?: string, [key: string]: unknown }>,
 *   subscriptionDocs?: Array<{ id: string, ownerUid?: string, data?: Record<string, unknown> }>,
 * }} input
 */
export function mergeAdminDirectory({
  userDocs = [],
  petDocs = [],
  publicDocs = [],
  companyDocs = [],
  shelterDocs = [],
  subscriptionDocs = [],
} = {}) {
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

  for (const company of companyDocs) {
    const ownerUid = str(company.ownerUid);
    if (!ownerUid) continue;
    if (!usersByUid.has(ownerUid)) {
      usersByUid.set(
        ownerUid,
        emptyUser(ownerUid, {
          email: str(company.publicEmail),
          name: str(company.businessName),
          phone: str(company.phoneNumber),
          accountType: 'company',
        })
      );
    }
    const user = usersByUid.get(ownerUid);
    user.accountType = 'company';
    user.profileKind = 'company';
    user.profileName = str(company.businessName);
    user.profileStatus = str(company.status) || 'pending';
    user.profileId = str(company.id);
    if (!user.email && company.publicEmail) user.email = str(company.publicEmail);
    if (!user.phone && company.phoneNumber) user.phone = str(company.phoneNumber);
    if (!user.name && company.businessName) user.name = str(company.businessName);
  }

  for (const shelter of shelterDocs) {
    const ownerUid = str(shelter.ownerUid);
    if (!ownerUid) continue;
    if (!usersByUid.has(ownerUid)) {
      usersByUid.set(
        ownerUid,
        emptyUser(ownerUid, {
          email: str(shelter.publicEmail),
          name: str(shelter.shelterName),
          phone: str(shelter.phoneNumber),
          accountType: 'shelter',
        })
      );
    }
    const user = usersByUid.get(ownerUid);
    user.accountType = 'shelter';
    user.profileKind = 'shelter';
    user.profileName = str(shelter.shelterName);
    user.profileStatus = str(shelter.status) || 'pending';
    user.profileId = str(shelter.id);
    if (!user.email && shelter.publicEmail) user.email = str(shelter.publicEmail);
    if (!user.phone && shelter.phoneNumber) user.phone = str(shelter.phoneNumber);
    if (!user.name && shelter.shelterName) user.name = str(shelter.shelterName);
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

  for (const sub of subscriptionDocs) {
    const ownerUid = str(sub.ownerUid) || str(sub.data?.uid);
    if (!ownerUid) continue;
    if (!usersByUid.has(ownerUid)) {
      usersByUid.set(ownerUid, emptyUser(ownerUid, { accountType: 'unknown' }));
    }
    const row = mapSubscriptionRow(sub.data || {}, sub.id, ownerUid);
    if (row.status && row.status !== 'active') continue;
    const user = usersByUid.get(ownerUid);
    const dup = user.subscriptions.some(
      (s) => s.subscriptionId === row.subscriptionId || (row.paymentId && s.paymentId === row.paymentId && s.sku === row.sku)
    );
    if (!dup) user.subscriptions.push(row);
  }

  for (const user of usersByUid.values()) {
    user.subscriptions.sort((a, b) => {
      const am = a.nextRenewalAtMs == null ? Number.POSITIVE_INFINITY : a.nextRenewalAtMs;
      const bm = b.nextRenewalAtMs == null ? Number.POSITIVE_INFINITY : b.nextRenewalAtMs;
      return am - bm;
    });
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
      u.profileKind,
      u.profileName,
      u.profileStatus,
      u.profileId,
      ...u.pets.flatMap((p) => [p.name, p.publicId, p.imei, p.id, p.breed]),
      ...((u.subscriptions || []).flatMap((s) => [s.paymentId, s.subscriptionId, s.sku, s.trackerImei])),
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
  const [usersSnap, publicSnap, companiesSnap, sheltersSnap, billingSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'publicPets')),
    getDocs(collection(db, 'companies')),
    getDocs(collection(db, 'shelters')),
    getDocs(collection(db, 'billingSubscriptions')),
  ]);

  const userDocs = usersSnap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  const publicDocs = publicSnap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  const companyDocs = companiesSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  const shelterDocs = sheltersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

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

  /** @type {Array<{ id: string, ownerUid: string, data: Record<string, unknown> }>} */
  let subscriptionDocs = [];
  try {
    const trackerSnap = await getDocs(collectionGroup(db, 'trackerSubscriptions'));
    subscriptionDocs = trackerSnap.docs.map((d) => ({
      id: d.id,
      ownerUid: d.ref.parent?.parent?.id || str(d.data()?.uid),
      data: d.data() || {},
    }));
  } catch {
    const snaps = await Promise.all(
      usersSnap.docs.map((u) => getDocs(collection(db, 'users', u.id, 'trackerSubscriptions')))
    );
    subscriptionDocs = snaps.flatMap((snap, i) =>
      snap.docs.map((d) => ({
        id: d.id,
        ownerUid: usersSnap.docs[i].id,
        data: d.data() || {},
      }))
    );
  }

  for (const d of billingSnap.docs) {
    const data = d.data() || {};
    if (str(data.status) && str(data.status) !== 'active') continue;
    subscriptionDocs.push({
      id: d.id,
      ownerUid: str(data.uid),
      data,
    });
  }

  return mergeAdminDirectory({
    userDocs,
    petDocs,
    publicDocs,
    companyDocs,
    shelterDocs,
    subscriptionDocs,
  });
}
