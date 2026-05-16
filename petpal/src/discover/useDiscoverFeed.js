import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDiscoverFeedPage } from '../data/discoverFeed';

export function useDiscoverFeed({ pageSize = 4 } = {}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async (pageIndex, append) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const { items: batch, hasMore: more } = await fetchDiscoverFeedPage({ page: pageIndex, pageSize });
        setItems((prev) => (append ? [...prev, ...batch] : batch));
        setHasMore(more);
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
    void loadPage(0, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    void loadPage(page + 1, true);
  }, [hasMore, loadingMore, loading, loadPage, page]);

  const refresh = useCallback(() => {
    void loadPage(0, false);
  }, [loadPage]);

  return { items, loading, loadingMore, hasMore, error, loadMore, refresh };
}
