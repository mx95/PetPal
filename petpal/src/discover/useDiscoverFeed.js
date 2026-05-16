import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDiscoverFeedPage } from '../data/discoverFeed';
import { fetchDiscoverFeedHybrid } from './discoverFeedFirestore';

export function useDiscoverFeed({ pageSize = 4 } = {}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [source, setSource] = useState('loading');
  const loadingRef = useRef(false);
  const cursorRef = useRef(null);
  const modeRef = useRef('hybrid');

  const loadPage = useCallback(
    async (pageIndex, append) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        let result;
        if (modeRef.current === 'seed') {
          const seed = await fetchDiscoverFeedPage({ page: pageIndex, pageSize });
          result = { items: seed.items, cursor: null, hasMore: seed.hasMore, source: 'seed' };
        } else {
          result = await fetchDiscoverFeedHybrid({
            pageIndex,
            pageSize,
            firestoreCursor: append ? cursorRef.current : null,
          });
          if (pageIndex === 0 && result.source === 'seed') {
            modeRef.current = 'seed';
          } else if (result.source === 'firestore' && result.items.length > 0) {
            modeRef.current = 'firestore';
          }
        }
        cursorRef.current = result.cursor;
        setSource(result.source || 'unknown');
        setItems((prev) => {
          if (!append) return result.items;
          const seen = new Set(prev.map((p) => p.dedupeKey || p.id));
          const merged = [...prev];
          for (const row of result.items) {
            const key = row.dedupeKey || row.id;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(row);
            }
          }
          return merged;
        });
        setHasMore(result.hasMore);
        setPage(pageIndex);
      } catch (e) {
        setError(e?.message || 'Could not load feed');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [pageSize]
  );

  useEffect(() => {
    cursorRef.current = null;
    void loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    void loadPage(page + 1, true);
  }, [hasMore, loadingMore, loading, loadPage, page]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    modeRef.current = 'hybrid';
    void loadPage(0, false);
  }, [loadPage]);

  return { items, loading, loadingMore, hasMore, error, source, loadMore, refresh };
}
