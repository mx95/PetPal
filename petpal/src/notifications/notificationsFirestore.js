import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';

export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  push: true,
  zone: true,
  battery: true,
  sos: true,
  offline: true,
});

function notificationsCol(uid) {
  return collection(getDb(), 'users', uid, 'notifications');
}

function prefsRef(uid) {
  return doc(getDb(), 'users', uid, 'settings', 'notifications');
}

/** @param {import('firebase/firestore').QueryDocumentSnapshot} d */
function docToNotification(d) {
  const x = d.data() || {};
  const createdAt = x.createdAt?.toDate?.() ? x.createdAt.toDate().toISOString() : null;
  return {
    id: d.id,
    type: String(x.type || ''),
    petId: x.petId || null,
    petName: String(x.petName || '').trim(),
    imei: x.imei || null,
    params: x.params && typeof x.params === 'object' ? x.params : {},
    lat: Number.isFinite(x.lat) ? x.lat : null,
    lng: Number.isFinite(x.lng) ? x.lng : null,
    read: x.read === true,
    createdAt,
  };
}

/**
 * @param {string} uid
 * @param {(rows: ReturnType<typeof docToNotification>[]) => void} onNext
 * @param {(e: Error) => void} [onError]
 */
export function subscribeNotifications(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext([]);
    return () => {};
  }
  const q = query(notificationsCol(uid), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map(docToNotification)),
    (e) => {
      if (onError) onError(e);
      else onNext([]);
    }
  );
}

export async function markNotificationRead(uid, id) {
  if (!isFirebaseConfigured() || !uid || !id) return;
  await setDoc(doc(getDb(), 'users', uid, 'notifications', id), { read: true }, { merge: true });
}

export async function markAllNotificationsRead(uid, ids) {
  if (!isFirebaseConfigured() || !uid || !ids?.length) return;
  const db = getDb();
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) {
      batch.set(doc(db, 'users', uid, 'notifications', id), { read: true }, { merge: true });
    }
    await batch.commit();
  }
}

export async function deleteNotification(uid, id) {
  if (!isFirebaseConfigured() || !uid || !id) return;
  await deleteDoc(doc(getDb(), 'users', uid, 'notifications', id));
}

/**
 * @param {string} uid
 * @param {(prefs: typeof DEFAULT_NOTIFICATION_PREFS) => void} onNext
 */
export function subscribeNotificationPrefs(uid, onNext) {
  if (!isFirebaseConfigured() || !uid) {
    onNext({ ...DEFAULT_NOTIFICATION_PREFS });
    return () => {};
  }
  return onSnapshot(
    prefsRef(uid),
    (snap) => onNext({ ...DEFAULT_NOTIFICATION_PREFS, ...pickPrefs(snap.data()) }),
    () => onNext({ ...DEFAULT_NOTIFICATION_PREFS })
  );
}

function pickPrefs(data) {
  const out = {};
  if (!data) return out;
  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
    if (typeof data[key] === 'boolean') out[key] = data[key];
  }
  return out;
}

export async function saveNotificationPrefs(uid, patch) {
  if (!isFirebaseConfigured() || !uid) return;
  await setDoc(prefsRef(uid), { ...pickPrefs(patch), updatedAt: serverTimestamp() }, { merge: true });
}

function tokenDocId(token) {
  let h = 5381;
  for (let i = 0; i < token.length; i += 1) h = ((h * 33) ^ token.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}_${token.length}_${token.slice(-12).replace(/[^A-Za-z0-9_-]/g, '')}`;
}

export async function savePushToken(uid, token, lang) {
  if (!isFirebaseConfigured() || !uid || !token) return;
  await setDoc(
    doc(getDb(), 'users', uid, 'pushTokens', tokenDocId(token)),
    {
      token,
      lang: ['en', 'el', 'ru'].includes(lang) ? lang : 'en',
      platform: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 200) : '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deletePushToken(uid, token) {
  if (!isFirebaseConfigured() || !uid || !token) return;
  await deleteDoc(doc(getDb(), 'users', uid, 'pushTokens', tokenDocId(token)));
}

export function safeZoneRef(uid, petId) {
  return doc(getDb(), 'users', uid, 'safeZones', petId);
}

/**
 * @param {string} uid
 * @param {string} petId
 * @param {(zone: null | { enabled: boolean, lat: number, lng: number, radiusM: number, notifyExit: boolean, notifyEnter: boolean }) => void} onNext
 */
export function subscribeSafeZone(uid, petId, onNext) {
  if (!isFirebaseConfigured() || !uid || !petId) {
    onNext(null);
    return () => {};
  }
  return onSnapshot(
    safeZoneRef(uid, petId),
    (snap) => {
      const x = snap.data();
      if (!x || !Number.isFinite(x.lat) || !Number.isFinite(x.lng) || !Number.isFinite(x.radiusM)) {
        onNext(null);
        return;
      }
      onNext({
        enabled: x.enabled !== false,
        lat: x.lat,
        lng: x.lng,
        radiusM: x.radiusM,
        notifyExit: x.notifyExit !== false,
        notifyEnter: x.notifyEnter !== false,
      });
    },
    () => onNext(null)
  );
}

export async function saveSafeZone(uid, petId, zone) {
  await setDoc(
    safeZoneRef(uid, petId),
    {
      enabled: zone.enabled !== false,
      lat: zone.lat,
      lng: zone.lng,
      radiusM: Math.round(zone.radiusM),
      notifyExit: zone.notifyExit !== false,
      notifyEnter: zone.notifyEnter !== false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteSafeZone(uid, petId) {
  await deleteDoc(safeZoneRef(uid, petId));
}
