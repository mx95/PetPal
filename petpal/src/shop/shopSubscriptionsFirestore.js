import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { PLUS_SKUS } from './catalog';

const TEARDOWN_DELAY_MS = 150;

/** @typedef {{ id: string, sku?: string, status?: string, createdAt?: unknown, trackerImei?: string, imei?: string, petId?: string, petName?: string, includeTracker?: boolean, nfcPetIds?: string[] }} TrackerSubscriptionRow */

/** @typedef {{ plusActiveBySku: Record<string, boolean>, legacyMonthlyActive: boolean, activeTrackerSubs: TrackerSubscriptionRow[] }} ShopSubscriptionState */

function emptyState() {
  return {
    plusActiveBySku: PLUS_SKUS.reduce((acc, id) => ({ ...acc, [id]: false }), {}),
    legacyMonthlyActive: false,
    activeTrackerSubs: /** @type {TrackerSubscriptionRow[]} */ ([]),
  };
}

function cloneState(state) {
  return {
    plusActiveBySku: { ...state.plusActiveBySku },
    legacyMonthlyActive: state.legacyMonthlyActive,
    activeTrackerSubs: [...state.activeTrackerSubs],
  };
}

/** @type {Map<string, { refCount: number, state: ShopSubscriptionState, unsubs: (() => void)[], subscribers: Set<(state: ShopSubscriptionState) => void>, teardownTimer: ReturnType<typeof setTimeout> | null, attachTimer: ReturnType<typeof setTimeout> | null }>} */
const pools = new Map();

function notify(uid) {
  const pool = pools.get(uid);
  if (!pool) return;
  const snapshot = cloneState(pool.state);
  for (const fn of pool.subscribers) {
    fn(snapshot);
  }
}

function attachListeners(uid) {
  const pool = pools.get(uid);
  if (!pool || pool.unsubs.length) return;

  const db = getDb();
  const onSnapErr = (label) => (error) => {
    console.warn(`Shop Firestore listener (${label})`, error);
  };

  const unsubs = PLUS_SKUS.filter((sku) => sku !== 'PETPAL_PLUS_MONTHLY').map((sku) =>
    onSnapshot(
      doc(db, 'billingSubscriptions', `${uid}_${sku}`),
      (snap) => {
        pool.state.plusActiveBySku = {
          ...pool.state.plusActiveBySku,
          [sku]: Boolean(snap.exists() && snap.data()?.status === 'active'),
        };
        notify(uid);
      },
      onSnapErr(`billingSubscriptions_${sku}`)
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'billingSubscriptions', `${uid}_PETPAL_PLUS_MONTHLY`),
      (snap) => {
        const data = snap.data() || {};
        pool.state.legacyMonthlyActive = Boolean(
          snap.exists() && data.status === 'active' && data.nextRenewalAt
        );
        notify(uid);
      },
      (error) => {
        onSnapErr('billingSubscriptions_monthly')(error);
        pool.state.legacyMonthlyActive = false;
        notify(uid);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'trackerSubscriptions'), where('status', '==', 'active')),
      (snap) => {
        pool.state.activeTrackerSubs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notify(uid);
      },
      (error) => {
        onSnapErr('trackerSubscriptions')(error);
        pool.state.activeTrackerSubs = [];
        notify(uid);
      }
    )
  );

  pool.unsubs = unsubs;
}

function ensurePool(uid) {
  let pool = pools.get(uid);
  if (!pool) {
    pool = {
      refCount: 0,
      state: emptyState(),
      unsubs: [],
      subscribers: new Set(),
      teardownTimer: null,
      attachTimer: null,
    };
    pools.set(uid, pool);
  }
  if (pool.teardownTimer) {
    clearTimeout(pool.teardownTimer);
    pool.teardownTimer = null;
  }
  return pool;
}

/**
 * Shared, ref-counted shop subscription listeners.
 * Delays attach/teardown slightly so React StrictMode mount cycles do not race Firestore targets.
 * @param {string} uid
 * @param {(state: ShopSubscriptionState) => void} onNext
 */
export function subscribeShopSubscriptionState(uid, onNext) {
  if (!uid || !isFirebaseConfigured()) {
    onNext(emptyState());
    return () => {};
  }

  const pool = ensurePool(uid);
  pool.refCount += 1;
  pool.subscribers.add(onNext);
  onNext(cloneState(pool.state));

  if (!pool.unsubs.length && !pool.attachTimer) {
    pool.attachTimer = setTimeout(() => {
      pool.attachTimer = null;
      const current = pools.get(uid);
      if (current && current.refCount > 0 && !current.unsubs.length) {
        attachListeners(uid);
      }
    }, 0);
  }

  return () => {
    const current = pools.get(uid);
    if (!current) return;
    current.subscribers.delete(onNext);
    current.refCount = Math.max(0, current.refCount - 1);
    if (current.refCount > 0) return;

    if (current.attachTimer) {
      clearTimeout(current.attachTimer);
      current.attachTimer = null;
    }

    current.teardownTimer = setTimeout(() => {
      const p = pools.get(uid);
      if (!p || p.refCount > 0) return;
      for (const unsub of p.unsubs) unsub();
      pools.delete(uid);
    }, TEARDOWN_DELAY_MS);
  };
}
