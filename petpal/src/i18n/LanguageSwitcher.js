import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SUPPORTED, useI18n } from './I18nContext';

const FLAG_EMOJI = { en: '🇬🇧', el: '🇬🇷', ru: '🇷🇺' };
const LANGUAGE_LABEL = {
  en: 'English',
  el: 'Greek',
  ru: 'Russian',
};

const LANGUAGE_SHORT = {
  en: 'EN',
  el: 'EL',
  ru: 'RU',
};

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
        <span className="pp-langSelectWrap__flag" aria-hidden>
          {FLAG_EMOJI[language] || '🌐'}
        </span>
        <button
          id="pp-language-select"
          type="button"
          className="pp-langSelect pp-langSelect--minimal"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={t('languageSwitcher.ariaSelect')}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={t('languageSwitcher.selectHint')}
        >
          <span className="pp-langSelect__code">{LANGUAGE_SHORT[language] || language.toUpperCase()}</span>
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
                      {FLAG_EMOJI[code] || '🌐'}
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
