import React from 'react';
import { cx } from './classNames';

export function SegmentedTabs({ tabs, value, onChange, ariaLabel }) {
  return (
    <div className="inline-flex rounded-full border border-white/80 bg-white/75 p-1 shadow-soft backdrop-blur" role="group" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            className={cx(
              'rounded-full px-4 py-2 text-sm font-black transition-all duration-300',
              active ? 'bg-petpal-ink text-white shadow-soft' : 'text-petpal-muted hover:bg-petpal-soft hover:text-petpal-ink'
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

