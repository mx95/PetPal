import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDiscoverFeedPage } from '../data/discoverFeed';
import { fetchDiscoverFeedHybrid } from './discoverFeedFirestore';

export function useDiscoverFeed({ pageSize = 4 } = {}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('loading');
  const loadingRef = useRef(false);
  const cursorRef = useRef(null);
  const modeRef = useRef('hybrid');
  const itemsRef = useRef([]);
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  const loadPage = useCallback(async (pageIndex, append) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (append) {
      setLoadingMore(true);
    } else if (itemsRef.current.length === 0) {
      setLoading(true);
    }
    setError('');
    try {
      const size = pageSizeRef.current;
      let result;
      if (modeRef.current === 'seed') {
        const seed = await fetchDiscoverFeedPage({ page: pageIndex, pageSize: size });
        result = { items: seed.items, cursor: null, hasMore: seed.hasMore, source: 'seed' };
      } else {
        result = await fetchDiscoverFeedHybrid({
          pageIndex,
          pageSize: size,
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
        const next = !append
          ? result.items
          : (() => {
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
            })();
        itemsRef.current = next;
        return next;
      });
      setHasMore(Boolean(result.hasMore));
      setPage(pageIndex);
    } catch (e) {
      setError(e?.message || 'Could not load feed');
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, []);

  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  useEffect(() => {
    cursorRef.current = null;
    modeRef.current = 'hybrid';
    void loadPageRef.current(0, false);
  }, []);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    void loadPageRef.current(page + 1, true);
  }, [hasMore, page]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    modeRef.current = 'hybrid';
    void loadPageRef.current(0, false);
  }, []);

  return { items, loading, loadingMore, hasMore, error, source, loadMore, refresh };
}
