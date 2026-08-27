import React from 'react';
import ActivityPetsIcon from './icons/ActivityPetsIcon';

/** Colored chip icons for account menu entries — consistent with Lost Pets / Shelters. */
const TONES = {
  inbox: { icon: '📬', className: 'pp-menuActionIcon pp-menuActionIcon--inbox' },
  pets: { icon: '🐾', className: 'pp-menuActionIcon pp-menuActionIcon--pets' },
  lost: { icon: '🚨', className: 'pp-menuActionIcon pp-menuActionIcon--lost' },
  shelter: { icon: '🏠', className: 'pp-menuActionIcon pp-menuActionIcon--shelter' },
  activity: { className: 'pp-menuActionIcon pp-menuActionIcon--activity', render: () => <ActivityPetsIcon size={16} /> },
  bookings: { icon: '📅', className: 'pp-menuActionIcon pp-menuActionIcon--bookings' },
  profile: { icon: '👤', className: 'pp-menuActionIcon pp-menuActionIcon--profile' },
  logout: { icon: '↩️', className: 'pp-menuActionIcon pp-menuActionIcon--logout' },
  admin: { icon: '📅', className: 'pp-menuActionIcon pp-menuActionIcon--admin' },
};

/**
 * @param {{ tone: keyof typeof TONES }} props
 */
export default function MenuActionIcon({ tone }) {
  const cfg = TONES[tone];
  if (!cfg) return null;
  return (
    <span className={cfg.className} aria-hidden>
      {cfg.render ? cfg.render() : cfg.icon}
    </span>
  );
}
