import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { SAMPLE_BREEDING_LISTINGS } from './sampleBreedingListings';
import { subscribeBreedingListings } from './breedingFirestore';

export function useBreedingListings() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [listings, setListings] = useState(/** @type {import('./breedingTypes').BreedingListing[]} */ ([]));
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
    const unsub = subscribeBreedingListings((rows, err) => {
      setListings(rows);
      setLoading(false);
      setError(err ? err.message : null);
    });
    return () => unsub();
  }, [uid, backendOk]);

  const mine = useMemo(() => (uid ? listings.filter((x) => x.ownerUid === uid) : []), [listings, uid]);

  const activeFeed = useMemo(() => {
    const real = listings.filter((x) => x.status === 'active');
    if (real.length > 0) return real;
    return SAMPLE_BREEDING_LISTINGS;
  }, [listings]);

  return { listings, activeFeed, mine, loading, error, backendOk };
}
