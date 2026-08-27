import React from 'react';

/** Reuses Premium hub action-card icon styling for menu entries. */
const TONES = {
  lost: { icon: '🚨', className: 'pp-menuActionIcon pp-menuActionIcon--lost' },
  shelter: { icon: '🏠', className: 'pp-menuActionIcon pp-menuActionIcon--shelter' },
};

/**
 * @param {{ tone: 'lost' | 'shelter' }} props
 */
export default function MenuActionIcon({ tone }) {
  const cfg = TONES[tone];
  return (
    <span className={cfg.className} aria-hidden>
      {cfg.icon}
    </span>
  );
}
