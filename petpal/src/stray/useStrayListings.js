import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { SAMPLE_STRAY_LISTINGS } from './sampleStrayListings';
import { subscribeStrayListings } from './strayFirestore';

/**
 * @returns {{ listings: import('./strayTypes').StrayListing[], loading: boolean, error: string | null, backendOk: boolean }}
 */
export function useStrayListings() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [listings, setListings] = useState(/** @type {import('./strayTypes').StrayListing[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const backendOk = isFirebaseConfigured();

  useEffect(() => {
    if (!uid || !backendOk) {
      setListings([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    const unsub = subscribeStrayListings((rows, err) => {
      setListings(rows);
      setLoading(false);
      setError(err ? err.message : null);
    });
    return () => unsub();
  }, [uid, backendOk]);

  const mine = useMemo(() => (uid ? listings.filter((x) => x.reporterUid === uid) : []), [listings, uid]);

  /** Real available rows from Firestore; when none, show built-in samples so the board is never blank. */
  const availableFeed = useMemo(() => {
    const real = listings.filter((x) => x.status === 'available');
    if (real.length > 0) return real;
    return SAMPLE_STRAY_LISTINGS;
  }, [listings]);

  return { listings, availableFeed, mine, loading, error, backendOk };
}
