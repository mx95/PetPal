import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { DEFAULT_NFC_TAG_DESIGNS, DEFAULT_TRACKER_SHOP_IMAGE } from '../data/nfcTagDesigns';

export const SHOP_ASSETS_DOC = 'shopAssets';

/**
 * @typedef {{
 *   nfcDesigns?: Array<{ id: number, name: string, image: string, enabled?: boolean }>,
 *   trackerImage?: string,
 *   updatedAt?: unknown,
 * }} ShopAssetsDoc
 */

/** @returns {ShopAssetsDoc} */
export function defaultShopAssetsDoc() {
  return {
    nfcDesigns: DEFAULT_NFC_TAG_DESIGNS.map((d) => ({
      id: d.id,
      name: d.name,
      image: d.image,
      enabled: true,
    })),
    trackerImage: DEFAULT_TRACKER_SHOP_IMAGE,
  };
}

/**
 * @param {(doc: ShopAssetsDoc | null) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeShopAssets(onData, onError) {
  const db = getFirebaseDb();
  if (!db) {
    onData(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'adminConfig', SHOP_ASSETS_DOC),
    (snap) => {
      onData(snap.exists() ? /** @type {ShopAssetsDoc} */ (snap.data()) : null);
    },
    (err) => onError?.(err)
  );
}

/** @param {ShopAssetsDoc} payload */
export async function saveShopAssets(payload) {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase is not configured.');
  await setDoc(
    doc(db, 'adminConfig', SHOP_ASSETS_DOC),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
