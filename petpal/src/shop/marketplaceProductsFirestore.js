import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { isMarketplaceCategory } from './marketplaceCategories';
import {
  COMMISSION_DEFAULT,
  COMMISSION_SELF_SHIP,
  PETPAL_SELLER_NAME,
  commissionRateForSelfShip,
  syncLinkedPrices,
} from './marketplacePricing';

const COL = 'marketplaceProducts';

function productsCol() {
  return collection(getDb(), COL);
}

function productRef(id) {
  return doc(getDb(), COL, id);
}

function normalizeProduct(id, data) {
  const selfShip = Boolean(data?.selfShip);
  const rate = Number(data?.commissionPercent) === 10 || selfShip ? COMMISSION_SELF_SHIP : COMMISSION_DEFAULT;
  const synced = syncLinkedPrices({
    merchantPriceCents: data?.merchantPriceCents,
    listedPriceCents: data?.listedPriceCents,
    selfShip,
    lastEdited: 'merchant',
  });
  return {
    id,
    title: String(data?.title || '').trim(),
    description: String(data?.description || '').trim(),
    category: isMarketplaceCategory(data?.category) ? data.category : 'accessories',
    imageUrl: data?.imageUrl ? String(data.imageUrl) : '',
    imageStoragePath: data?.imageStoragePath ? String(data.imageStoragePath) : '',
    merchantPriceCents: Number.isFinite(Number(data?.merchantPriceCents))
      ? Math.max(0, Math.round(Number(data.merchantPriceCents)))
      : synced.merchantPriceCents,
    listedPriceCents: Number.isFinite(Number(data?.listedPriceCents))
      ? Math.max(0, Math.round(Number(data.listedPriceCents)))
      : synced.listedPriceCents,
    commissionPercent: Math.round(rate * 100),
    selfShip,
    sellerType: data?.sellerType === 'petpal' ? 'petpal' : 'company',
    companyId: data?.companyId ? String(data.companyId) : '',
    companyName: String(data?.companyName || '').trim() || PETPAL_SELLER_NAME,
    status: data?.status === 'approved' || data?.status === 'rejected' || data?.status === 'pending'
      ? data.status
      : 'pending',
    active: data?.active !== false,
    createdBy: data?.createdBy ? String(data.createdBy) : '',
    createdAt: data?.createdAt || null,
    updatedAt: data?.updatedAt || null,
    reviewedAt: data?.reviewedAt || null,
    reviewedBy: data?.reviewedBy ? String(data.reviewedBy) : '',
  };
}

/**
 * @param {(products: ReturnType<typeof normalizeProduct>[]) => void} onData
 * @param {(err: Error) => void} [onError]
 */
export function subscribeApprovedMarketplaceProducts(onData, onError) {
  if (!isFirebaseConfigured()) {
    onData([]);
    return () => {};
  }
  const q = query(
    productsCol(),
    where('status', '==', 'approved'),
    where('active', '==', true),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => normalizeProduct(d.id, d.data())));
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      else onData([]);
    }
  );
}

export function subscribeCompanyMarketplaceProducts(companyId, onData, onError) {
  if (!isFirebaseConfigured() || !companyId) {
    onData([]);
    return () => {};
  }
  const q = query(productsCol(), where('companyId', '==', companyId), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => normalizeProduct(d.id, d.data())));
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      else onData([]);
    }
  );
}

export function subscribeAllMarketplaceProducts(onData, onError) {
  if (!isFirebaseConfigured()) {
    onData([]);
    return () => {};
  }
  const q = query(productsCol(), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => normalizeProduct(d.id, d.data())));
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      else onData([]);
    }
  );
}

export function subscribePendingMarketplaceProducts(onData, onError) {
  if (!isFirebaseConfigured()) {
    onData([]);
    return () => {};
  }
  const q = query(productsCol(), where('status', '==', 'pending'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => normalizeProduct(d.id, d.data())));
    },
    (err) => {
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
      else onData([]);
    }
  );
}

/**
 * @param {{
 *   title: string,
 *   description?: string,
 *   category: string,
 *   merchantPriceCents: number,
 *   listedPriceCents: number,
 *   selfShip?: boolean,
 *   imageUrl?: string,
 *   imageStoragePath?: string,
 *   sellerType: 'company'|'petpal',
 *   companyId?: string,
 *   companyName?: string,
 *   createdBy: string,
 *   status?: 'pending'|'approved'|'rejected',
 *   active?: boolean,
 * }} input
 */
export async function createMarketplaceProduct(input) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const selfShip = Boolean(input.selfShip);
  const synced = syncLinkedPrices({
    merchantPriceCents: input.merchantPriceCents,
    listedPriceCents: dataListedOrMerchant(input),
    selfShip,
    lastEdited: 'merchant',
  });
  const sellerType = input.sellerType === 'petpal' ? 'petpal' : 'company';
  const status =
    input.status ||
    (sellerType === 'petpal' ? 'approved' : 'pending');
  const payload = {
    title: String(input.title || '').trim().slice(0, 120),
    description: String(input.description || '').trim().slice(0, 800),
    category: isMarketplaceCategory(input.category) ? input.category : 'accessories',
    imageUrl: input.imageUrl ? String(input.imageUrl).slice(0, 2000) : null,
    imageStoragePath: input.imageStoragePath ? String(input.imageStoragePath).slice(0, 500) : null,
    merchantPriceCents: synced.merchantPriceCents,
    listedPriceCents: synced.listedPriceCents,
    commissionPercent: Math.round(commissionRateForSelfShip(selfShip) * 100),
    selfShip,
    sellerType,
    companyId: sellerType === 'petpal' ? 'petpal' : String(input.companyId || '').trim(),
    companyName:
      sellerType === 'petpal'
        ? PETPAL_SELLER_NAME
        : String(input.companyName || '').trim().slice(0, 120) || 'Business',
    status,
    active: input.active !== false,
    createdBy: String(input.createdBy || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!payload.title) throw new Error('Enter a product title.');
  if (synced.listedPriceCents < 5) throw new Error('Listed price must be at least €0.05.');
  if (sellerType === 'company' && !payload.companyId) throw new Error('Missing business account.');
  const ref = await addDoc(productsCol(), payload);
  return ref.id;
}

function dataListedOrMerchant(input) {
  if (Number.isFinite(Number(input.listedPriceCents))) return Number(input.listedPriceCents);
  return Number(input.merchantPriceCents) || 0;
}

export async function updateMarketplaceProduct(productId, patch) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const id = String(productId || '').trim();
  if (!id) throw new Error('Missing product id.');
  const next = { updatedAt: serverTimestamp() };
  if (patch.title != null) next.title = String(patch.title).trim().slice(0, 120);
  if (patch.description != null) next.description = String(patch.description).trim().slice(0, 800);
  if (patch.category != null && isMarketplaceCategory(patch.category)) next.category = patch.category;
  if (patch.imageUrl !== undefined) next.imageUrl = patch.imageUrl ? String(patch.imageUrl).slice(0, 2000) : null;
  if (patch.imageStoragePath !== undefined) {
    next.imageStoragePath = patch.imageStoragePath ? String(patch.imageStoragePath).slice(0, 500) : null;
  }
  if (patch.selfShip != null || patch.merchantPriceCents != null || patch.listedPriceCents != null) {
    const selfShip = patch.selfShip != null ? Boolean(patch.selfShip) : Boolean(patch._selfShipFallback);
    const synced = syncLinkedPrices({
      merchantPriceCents: patch.merchantPriceCents ?? patch._merchantFallback ?? 0,
      listedPriceCents: patch.listedPriceCents ?? patch._listedFallback ?? 0,
      selfShip: patch.selfShip != null ? Boolean(patch.selfShip) : selfShip,
      lastEdited: patch.lastEdited === 'listed' ? 'listed' : 'merchant',
    });
    next.merchantPriceCents = synced.merchantPriceCents;
    next.listedPriceCents = synced.listedPriceCents;
    next.selfShip = patch.selfShip != null ? Boolean(patch.selfShip) : selfShip;
    next.commissionPercent = Math.round(commissionRateForSelfShip(next.selfShip) * 100);
  }
  if (patch.active != null) next.active = Boolean(patch.active);
  if (patch.status === 'pending' || patch.status === 'approved' || patch.status === 'rejected') {
    next.status = patch.status;
  }
  if (patch.reviewedBy) {
    next.reviewedBy = String(patch.reviewedBy);
    next.reviewedAt = serverTimestamp();
  }
  await updateDoc(productRef(id), next);
}

export async function setMarketplaceProductStatus(productId, status, adminUid) {
  await updateMarketplaceProduct(productId, {
    status,
    reviewedBy: adminUid,
  });
}

export async function deleteMarketplaceProduct(productId) {
  if (!isFirebaseConfigured()) throw new Error('Firebase is not configured');
  const id = String(productId || '').trim();
  if (!id) throw new Error('Missing product id.');
  await deleteDoc(productRef(id));
}

export { normalizeProduct };
