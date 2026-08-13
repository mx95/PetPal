import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

export default function AdminCopyButton({ value, label, copiedLabel }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const text = String(value || '').trim();
  if (!text) return null;

  async function copy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="pp-btn pp-btn--ghost pp-adminCopyBtn" onClick={copy} disabled={copied}>
      {copied ? copiedLabel || t('admin.hub.copied') : label || t('admin.hub.copy')}
    </button>
  );
}
