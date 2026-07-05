import React from 'react';

/** @typedef {{ id: 'vet'|'saloon'|'hotel'|'bath'|'walker', emoji: string, label: string }} ServiceTab */

/**
 * @param {{ tabs: ServiceTab[], value: string, onChange: (id: string) => void }} props
 */
export function ServiceTabs({ tabs, value, onChange }) {
  return (
    <div className="pp-book-serviceTabs" role="tablist" aria-label="Service type">
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
