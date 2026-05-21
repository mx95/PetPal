import React from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useMobileDockLayout } from '../hooks/useMobileDockLayout';
import { useI18n } from '../i18n/I18nContext';
import { MVP_NAV } from '../config/mvpNav';
import { useAuth } from '../auth/AuthProvider';

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  pets: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <ellipse cx="9" cy="12" rx="3" ry="4" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="15.5" cy="12.5" rx="2.6" ry="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 17c2 2 10 2 13 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  tracking: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity="0.45" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.6" opacity="0.75" />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.45" stroke="none" />
    </svg>
  ),
  nearby: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  community: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="9" cy="11" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c1-3 11-4 12 0M14 20c.6-1.7 5.4-2.5 7-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  bookings: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M7 3v3M17 3v3M4.5 7.5h15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v10.5A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5V8A2.5 2.5 0 0 1 6.5 5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M8 11h3M8 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  provider: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M8 7V6a4 4 0 0 1 8 0v1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 7.5h11A2.5 2.5 0 0 1 20 10v8.5A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5V10A2.5 2.5 0 0 1 6.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M10 12h4M10 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  shop: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M6 8h14l-1.2 9.5a2 2 0 0 1-2 1.7H9.2a2 2 0 0 1-2-1.7L6 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 8V6.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const BASE_ITEMS = [
  { to: '/', end: true, key: 'home', labelKey: 'bottomNav.home' },
  { to: '/pets', key: 'pets', labelKey: 'bottomNav.pets' },
];

/** Mobile-first sticky bottom navigation with a centered FAB for "Start walk". */
export default function BottomNav() {
  const { user } = useAuth();
  const { t } = useI18n();
  useMobileDockLayout(Boolean(user));
  if (!user) return null;

  const left = BASE_ITEMS;
  const right = [
    ...(MVP_NAV.showShop ? [{ to: '/shop', key: 'shop', labelKey: 'nav.shop' }] : []),
    { to: '/nearby', key: 'nearby', labelKey: 'nav.nearby' },
    ...(MVP_NAV.showBookings ? [{ to: '/bookings', key: 'bookings', labelKey: 'bottomNav.bookings' }] : []),
  ];

  const Item = ({ item }) => (
    <NavLink
      key={item.key}
      to={item.to}
      end={item.end}
      className={({ isActive }) => `pp-bottomNav__item ${isActive ? 'pp-bottomNav__item--on' : ''}`}
      aria-label={t(item.labelKey)}
      title={t(item.labelKey)}
    >
      <span className="pp-bottomNav__icon">{ICONS[item.key]}</span>
      <span className="pp-bottomNav__label">{t(item.labelKey)}</span>
    </NavLink>
  );

  const dock = (
    <nav className="pp-bottomNav" aria-label={t('bottomNav.aria')}>
      <div className="pp-bottomNav__inner">
        <div className="pp-bottomNav__row">
          {left.map((it) => (
          <Item key={it.key} item={it} />
          ))}
          <NavLink
          to="/tracking"
          className={({ isActive }) => `pp-bottomNav__fab ${isActive ? 'pp-bottomNav__fab--on' : ''}`}
          aria-label={t('bottomNav.tracking')}
          title={t('bottomNav.tracking')}
        >
          <span className="pp-bottomNav__fabIcon" aria-hidden>{ICONS.tracking}</span>
          <span className="pp-bottomNav__fabLabel">{t('bottomNav.tracking')}</span>
          <span className="pp-bottomNav__fabPulse" aria-hidden />
        </NavLink>
        {right.map((it) => (
          <Item key={it.key} item={it} />
        ))}
      </div>
      </div>
    </nav>
  );

  // Portal keeps `position:fixed` on the visual viewport (iOS + maps / backdrop-filter quirks).
  if (typeof document !== 'undefined') {
    return createPortal(dock, document.body);
  }
  return dock;
}
