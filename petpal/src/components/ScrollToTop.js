import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Scroll the page to the top whenever the route path changes. */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}
