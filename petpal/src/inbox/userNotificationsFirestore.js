import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { normalizeNotificationType } from './notificationTypes';

const NOTIFICATIONS = 'notifications';

function notificationsCol(uid) {
  return collection(getDb(), 'users', uid, NOTIFICATIONS);
}

function docToNotification(d) {
  const x = d.data() || {};
  const createdAt = x.createdAt?.toDate?.() ? x.createdAt.toDate().toISOString() : x.createdAt || null;
  const readAt = x.readAt?.toDate?.() ? x.readAt.toDate().toISOString() : x.readAt || null;
  return {
    id: d.id,
    title: String(x.title || '').trim(),
    body: String(x.body || '').trim(),
    type: normalizeNotificationType(x.type),
    link: x.link ? String(x.link).trim() : null,
    createdAt,
    readAt,
    createdBy: x.createdBy || null,
    createdByEmail: x.createdByEmail || null,
  };
}

/**
 * @param {string} uid
 * @param {(rows: Array<ReturnType<typeof docToNotification>>) => void} onNext
 * @param {(e: Error) => void} [onError]
 */
export function subscribeUserNotifications(uid, onNext, onError) {
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

/**
 * @param {string} uid
 * @param {{ title: string, body: string, type?: string, link?: string|null, createdBy: string, createdByEmail?: string|null }} payload
 */
export async function createUserNotification(uid, payload) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const targetUid = String(uid || '').trim();
  if (!targetUid) throw new Error('User id is required');
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!title) throw new Error('Title is required');
  if (!body) throw new Error('Message is required');
  const link = payload.link ? String(payload.link).trim() : null;
  const ref = await addDoc(notificationsCol(targetUid), {
    title,
    body,
    type: normalizeNotificationType(payload.type),
    link: link || null,
    readAt: null,
    createdBy: payload.createdBy,
    createdByEmail: payload.createdByEmail || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function markUserNotificationRead(uid, notificationId) {
  if (!isFirebaseConfigured() || !uid || !notificationId) return;
  await setDoc(
    doc(getDb(), 'users', uid, NOTIFICATIONS, notificationId),
    { readAt: serverTimestamp() },
    { merge: true }
  );
}

export async function markAllUserNotificationsRead(uid, notificationIds) {
  if (!isFirebaseConfigured() || !uid || !notificationIds?.length) return;
  const batch = writeBatch(getDb());
  for (const notificationId of notificationIds) {
    batch.set(
      doc(getDb(), 'users', uid, NOTIFICATIONS, notificationId),
      { readAt: serverTimestamp() },
      { merge: true }
    );
  }
  await batch.commit();
}
