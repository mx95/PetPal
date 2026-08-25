import React, { useEffect, useState } from 'react';

/**
 * Show a short skeleton until the image URL is ready and the bitmap has loaded,
 * so Shop does not flash a previous/default tracker photo.
 */
export default function ShopDeferredImage({ src, className, alt = '', style }) {
  const next = String(src || '').trim();
  const [loadedFor, setLoadedFor] = useState('');

  useEffect(() => {
    setLoadedFor('');
  }, [next]);

  if (!next) {
    return (
      <span
        className={`${className || ''} pp-shopDeferredImg pp-shopDeferredImg--pending`.trim()}
        style={style}
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      />
    );
  }

  const ready = loadedFor === next;

  return (
    <img
      className={`${className || ''} pp-shopDeferredImg${ready ? '' : ' pp-shopDeferredImg--pending'}`.trim()}
      style={{
        ...style,
        opacity: ready ? undefined : 0,
        // Keep layout while pending; CSS pending styles still apply via class.
      }}
      src={next}
      alt={alt}
      onLoad={() => setLoadedFor(next)}
      onError={() => setLoadedFor(next)}
    />
  );
}
