import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

/** Collapsed-by-default “View more / View less” for secondary marketing copy. */
export default function ViewMore({ children, className = '' }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className={`pp-viewMore${className ? ` ${className}` : ''}`}>
      {open ? <div className="pp-viewMore__body">{children}</div> : null}
      <button
        type="button"
        className="pp-viewMore__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? t('common.viewLess') : t('common.viewMore')}
      </button>
    </div>
  );
}
