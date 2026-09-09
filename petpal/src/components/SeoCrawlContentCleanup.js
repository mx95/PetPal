import { useEffect } from 'react';

/**
 * Removes server-injected crawl HTML after React mounts so users only see the app UI.
 * The block remains in the initial HTML response for crawlers and first-paint SEO signals.
 */
export function SeoCrawlContentCleanup() {
  useEffect(() => {
    const node = document.getElementById('pp-seo-crawl');
    if (node) node.remove();
  }, []);
  return null;
}
