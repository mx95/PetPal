import { useEffect, useMemo, useState } from 'react';
import {
  mergeNfcTagDesigns,
  resolveTrackerShopImage,
  DEFAULT_NFC_TAG_DESIGNS,
  DEFAULT_TRACKER_SHOP_IMAGE,
} from '../data/nfcTagDesigns';
import { subscribeShopAssets } from '../shop/shopAssetsFirestore';

/** Shop NFC designs + tracker product image (Firestore overrides with static defaults). */
export function useShopAssets() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    return subscribeShopAssets(
      (doc) => {
        setRaw(doc);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    );
  }, []);

  const nfcDesigns = useMemo(() => mergeNfcTagDesigns(raw), [raw]);
  const trackerImage = useMemo(() => resolveTrackerShopImage(raw), [raw]);

  return {
    raw,
    loading,
    err,
    nfcDesigns: nfcDesigns.length ? nfcDesigns : DEFAULT_NFC_TAG_DESIGNS,
    trackerImage: trackerImage || DEFAULT_TRACKER_SHOP_IMAGE,
  };
}
