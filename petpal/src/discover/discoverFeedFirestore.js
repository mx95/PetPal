import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
import { fetchDiscoverFeedPage } from '../data/discoverFeed';
import { mapDiscoverPostDoc } from './discoverFeedModel';

const COL = 'discoverPosts';

/**
 * @param {{ pageSize?: number, cursor?: import('firebase/firestore').QueryDocumentSnapshot | null }} opts
 */
export async function fetchDiscoverPostsFromFirestore({ pageSize = 6, cursor = null } = {}) {
  if (!isFirebaseConfigured()) {
    return { items: [], cursor: null, hasMore: false, source: 'offline' };
  }

  try {
    let q = query(
      collection(getDb(), COL),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    if (cursor) {
      q = query(
        collection(getDb(), COL),
        where('active', '==', true),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(pageSize)
      );
    }

    const snap = await getDocs(q);
    const items = snap.docs.map((d) => mapDiscoverPostDoc(d.id, d.data()));
    const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    return {
      items,
      cursor: last,
      hasMore: snap.docs.length >= pageSize,
      source: 'firestore',
    };
  } catch {
    return { items: [], cursor: null, hasMore: false, source: 'firestore_error' };
  }
}

/**
 * Merge Firestore page with seed content when the collection is still empty (demos / first launch).
 */
export async function fetchDiscoverFeedHybrid({ pageIndex, pageSize = 6, firestoreCursor = null }) {
  const fs = await fetchDiscoverPostsFromFirestore({ pageSize, cursor: firestoreCursor });

  if (pageIndex === 0 && fs.items.length === 0) {
    const seed = await fetchDiscoverFeedPage({ page: 0, pageSize });
    return {
      items: seed.items.map((s) => ({ ...s, dedupeKey: s.dedupeKey || s.id })),
      cursor: null,
      hasMore: seed.hasMore,
      source: 'seed',
    };
  }

  if (fs.items.length > 0) {
    return fs;
  }

  if (pageIndex > 0) {
    return { items: [], cursor: fs.cursor, hasMore: false, source: 'firestore' };
  }

  const seed = await fetchDiscoverFeedPage({ page: pageIndex, pageSize });
  return {
    items: seed.items,
    cursor: fs.cursor,
    hasMore: seed.hasMore,
    source: 'seed',
  };
}

/**
 * @param {string} uid
 * @param {{
 *   authorName: string,
 *   title: string,
 *   body: string,
 *   category?: string,
 *   sponsored?: boolean,
 *   ctaTo?: string,
 *   ctaLabelKey?: string,
 *   contactPhone?: string,
 *   contactEmail?: string,
 *   lat?: number,
 *   lng?: number,
 * }} payload
 */
export async function createDiscoverPost(uid, payload) {
  if (!isFirebaseConfigured()) throw new Error('firebase_unconfigured');
  const ref = await addDoc(collection(getDb(), COL), {
    authorUid: uid,
    authorName: String(payload.authorName || '').slice(0, 120),
    title: String(payload.title || '').slice(0, 160),
    body: String(payload.body || '').slice(0, 800),
    category: String(payload.category || 'default').slice(0, 32),
    type: 'business',
    sponsored: Boolean(payload.sponsored),
    verified: true,
    active: true,
    ctaTo: payload.ctaTo || '/bookings',
    ctaLabelKey: payload.ctaLabelKey || 'discover.feed.bookNow',
    contactPhone: payload.contactPhone ? String(payload.contactPhone).slice(0, 40) : '',
    contactEmail: payload.contactEmail ? String(payload.contactEmail).slice(0, 120) : '',
    lat: Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : null,
    lng: Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : null,
    likes: 0,
    comments: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
