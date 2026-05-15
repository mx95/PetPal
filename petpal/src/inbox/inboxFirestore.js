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

const BROADCAST = 'broadcastMessages';
const INBOX_READS = 'inboxReads';

function broadcastCol() {
  return collection(getDb(), BROADCAST);
}

function inboxReadsCol(uid) {
  return collection(getDb(), 'users', uid, INBOX_READS);
}

function docToMessage(d) {
  const x = d.data() || {};
  const createdAt = x.createdAt?.toDate?.() ? x.createdAt.toDate().toISOString() : x.createdAt || null;
  return {
    id: d.id,
    title: String(x.title || '').trim(),
    body: String(x.body || '').trim(),
    createdAt,
    createdBy: x.createdBy || null,
    createdByEmail: x.createdByEmail || null,
  };
}

/**
 * @param {(messages: Array<ReturnType<typeof docToMessage>>) => void} onNext
 * @param {(e: Error) => void} [onError]
 */
export function subscribeBroadcastMessages(onNext, onError) {
  if (!isFirebaseConfigured()) {
    onNext([]);
    return () => {};
  }
  const q = query(broadcastCol(), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map(docToMessage)),
    (e) => {
      if (onError) onError(e);
      else onNext([]);
    }
  );
}

/**
 * @param {string} uid
 * @param {(readIds: Set<string>) => void} onNext
 * @param {(e: Error) => void} [onError]
 */
export function subscribeInboxReads(uid, onNext, onError) {
  if (!isFirebaseConfigured() || !uid) {
    onNext(new Set());
    return () => {};
  }
  return onSnapshot(
    inboxReadsCol(uid),
    (snap) => onNext(new Set(snap.docs.map((d) => d.id))),
    (e) => {
      if (onError) onError(e);
      else onNext(new Set());
    }
  );
}

/**
 * @param {{ title: string, body: string, createdBy: string, createdByEmail?: string }} payload
 */
export async function createBroadcastMessage(payload) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  if (!title) throw new Error('Title is required');
  if (!body) throw new Error('Message is required');
  const ref = await addDoc(broadcastCol(), {
    title,
    body,
    createdBy: payload.createdBy,
    createdByEmail: payload.createdByEmail || null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function markInboxMessageRead(uid, messageId) {
  if (!isFirebaseConfigured() || !uid || !messageId) return;
  await setDoc(doc(getDb(), 'users', uid, INBOX_READS, messageId), {
    readAt: serverTimestamp(),
  });
}

export async function markAllInboxMessagesRead(uid, messageIds) {
  if (!isFirebaseConfigured() || !uid || !messageIds?.length) return;
  const batch = writeBatch(getDb());
  for (const messageId of messageIds) {
    batch.set(doc(getDb(), 'users', uid, INBOX_READS, messageId), { readAt: serverTimestamp() });
  }
  await batch.commit();
}
