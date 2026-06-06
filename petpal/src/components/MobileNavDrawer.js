import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen navigation drawer for phones and tablets (< lg breakpoint).
 */
export function MobileNavDrawer({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="pp-mobileNav" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="pp-mobileNav__backdrop" aria-label="Close menu" onClick={onClose} />
      <nav className="pp-mobileNav__panel">
        <div className="pp-mobileNav__head">
          <span className="pp-mobileNav__title">{title}</span>
          <button type="button" className="pp-mobileNav__close" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>
        <div className="pp-mobileNav__body">{children}</div>
      </nav>
    </div>,
    document.body
  );
}
