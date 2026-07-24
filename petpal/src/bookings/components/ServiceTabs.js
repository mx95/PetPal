import React from 'react';
import { useI18n } from '../../i18n/I18nContext';

/** @typedef {{ id: 'vet'|'saloon'|'hotel'|'bath'|'walker', emoji: string, label: string }} ServiceTab */

/**
 * @param {{ tabs: ServiceTab[], value: string, onChange: (id: string) => void }} props
 */
export function ServiceTabs({ tabs, value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="pp-book-serviceTabs" role="tablist" aria-label={t('bookingsHub.serviceTypeAria')}>
      {tabs.map((tab) => {
        const on = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            className={`pp-book-pill ${on ? 'is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="pp-book-pill__emoji" aria-hidden>
              {tab.emoji}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
