import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SUPPORTED, useI18n } from './I18nContext';

const LANGUAGE_LABEL = {
  en: 'English',
  el: 'Greek',
  ru: 'Russian',
};

function WorldIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role="img"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function FlagIcon({ code, className = '' }) {
  const c = String(code || '').toLowerCase();
  if (c === 'ru') {
    return (
      <svg className={`pp-langFlagSvg ${className}`.trim()} viewBox="0 0 24 16" role="img" aria-hidden="true">
        <rect width="24" height="16" fill="#ffffff" />
        <rect y="5.33" width="24" height="5.34" fill="#1c57a7" />
        <rect y="10.66" width="24" height="5.34" fill="#c92a2a" />
      </svg>
    );
  }
  if (c === 'el') {
    return (
      <svg className={`pp-langFlagSvg ${className}`.trim()} viewBox="0 0 24 16" role="img" aria-hidden="true">
        <rect width="24" height="16" fill="#0d5eaf" />
        <rect y="2" width="24" height="2" fill="#ffffff" />
        <rect y="6" width="24" height="2" fill="#ffffff" />
        <rect y="10" width="24" height="2" fill="#ffffff" />
        <rect y="14" width="24" height="2" fill="#ffffff" />
        <rect width="10" height="10" fill="#0d5eaf" />
        <rect x="4" width="2" height="10" fill="#ffffff" />
        <rect y="4" width="10" height="2" fill="#ffffff" />
      </svg>
    );
  }
  return (
    <svg className={`pp-langFlagSvg ${className}`.trim()} viewBox="0 0 24 16" role="img" aria-hidden="true">
      <rect width="24" height="16" fill="#1b4fbf" />
      <path
        d="M0 0 L3 0 L24 13 L24 16 L21 16 L0 3 Z M24 0 L21 0 L0 13 L0 16 L3 16 L24 3 Z"
        fill="#ffffff"
        opacity="0.95"
      />
      <path d="M0 0 L1.8 0 L24 14.2 L24 16 L22.2 16 L0 1.8 Z" fill="#d62d2d" opacity="0.95" />
      <path d="M24 0 L22.2 0 L0 14.2 L0 16 L1.8 16 L24 1.8 Z" fill="#d62d2d" opacity="0.95" />
      <rect x="9.2" width="5.6" height="16" fill="#ffffff" />
      <rect y="5.2" width="24" height="5.6" fill="#ffffff" />
      <rect x="10.2" width="3.6" height="16" fill="#d62d2d" />
      <rect y="6.2" width="24" height="3.6" fill="#d62d2d" />
    </svg>
  );
}

/**
 * Dropdown language selector (EN / EL / RU).
 *
 * @param {{ className?: string }} props
 */
export function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const onEsc = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const onSelect = useCallback(
    (code) => {
      setLanguage(code);
      setOpen(false);
    },
    [setLanguage]
  );

  return (
    <div className={`pp-langSwitcher ${className}`.trim()}>
      <label className="pp-sr" htmlFor="pp-language-select">
        {t('languageSwitcher.label')}
      </label>
      <div className="pp-langSelectWrap" ref={wrapRef}>
        <button
          id="pp-language-select"
          type="button"
          className="pp-langTrigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={`${t('languageSwitcher.ariaSelect')}: ${LANGUAGE_LABEL[language] || language}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={t('languageSwitcher.selectHint')}
        >
          <span className="pp-langTrigger__icon" aria-hidden>
            <WorldIcon className="pp-langFlagSvg" />
          </span>
        </button>

        {open && (
          <ul className="pp-langMenu" role="listbox" aria-label={t('languageSwitcher.ariaSelect')}>
            {SUPPORTED.map((code) => {
              const active = code === language;
              return (
                <li key={code}>
                  <button
                    type="button"
                    className={`pp-langMenu__item ${active ? 'is-active' : ''}`}
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(code)}
                  >
                    <span className="pp-langMenu__flag" aria-hidden>
                      <span className="pp-langFlagRing pp-langFlagRing--sm">
                        <FlagIcon code={code} className="pp-langFlagSvg--menu" />
                      </span>
                    </span>
                    <span>{LANGUAGE_LABEL[code] || code.toUpperCase()}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
