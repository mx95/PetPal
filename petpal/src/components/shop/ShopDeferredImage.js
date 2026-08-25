import React, { useEffect, useState } from 'react';

/**
 * Avoid flashing a previous/default shop image while Firestore overrides load,
 * and while a new src is still downloading after the URL changes.
 */
export default function ShopDeferredImage({ src, className, alt = '', style }) {
  const [displaySrc, setDisplaySrc] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const next = String(src || '').trim();
    if (!next) {
      setDisplaySrc('');
      setVisible(false);
      return undefined;
    }

    let cancelled = false;
    setVisible(false);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDisplaySrc(next);
      setVisible(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setDisplaySrc(next);
      setVisible(true);
    };
    img.src = next;
    if (img.complete && img.naturalWidth > 0) {
      setDisplaySrc(next);
      setVisible(true);
    }

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!displaySrc || !visible) {
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

  return (
    <img
      className={`${className || ''} pp-shopDeferredImg`.trim()}
      style={style}
      src={displaySrc}
      alt={alt}
    />
  );
}
