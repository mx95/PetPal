import React, { useCallback, useMemo } from 'react';
import { SUPPORTED, useI18n } from './I18nContext';

const FLAG_EMOJI = { en: '🇬🇧', el: '🇬🇷', ru: '🇷🇺' };

function getNextCode(current) {
  const i = SUPPORTED.indexOf(current);
  const next = (i + 1) % SUPPORTED.length;
  return SUPPORTED[next];
}

/**
 * One circular control: shows the active language flag; each click moves to the next language.
 *
 * @param {{ className?: string }} props
 */
export function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useI18n();
  const nextCode = useMemo(() => getNextCode(language), [language]);

  const nameCurrent = t(`languageSwitcher.lang.${language}`);
  const nameNext = t(`languageSwitcher.lang.${nextCode}`);

  const onClick = useCallback(() => {
    setLanguage(nextCode);
  }, [setLanguage, nextCode]);

  return (
    <div className={`pp-langSwitcher pp-langSwitcher--cycle ${className}`.trim()}>
      <button
        type="button"
        className="pp-langFlag pp-langFlag--solo pp-langFlag--active"
        onClick={onClick}
        aria-label={t('languageSwitcher.ariaCycle', { current: nameCurrent, next: nameNext })}
        title={t('languageSwitcher.switchHint', { next: nameNext })}
      >
        <span className="pp-langFlag__emoji" aria-hidden>
          {FLAG_EMOJI[language] || '·'}
        </span>
      </button>
    </div>
  );
}
