import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
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
  community: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="9" cy="11" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c1-3 11-4 12 0M14 20c.6-1.7 5.4-2.5 7-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="12" cy="9.5" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 21c1-3.5 13-3.5 14 0" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  ),
};

const ITEMS = [
  { to: '/', end: true, key: 'home', labelKey: 'bottomNav.home' },
  { to: '/pets', key: 'pets', labelKey: 'bottomNav.pets' },
  { to: '/tracking', key: 'tracking', labelKey: 'bottomNav.tracking' },
  { to: '/community', key: 'community', labelKey: 'bottomNav.community' },
  { to: '/profile', key: 'profile', labelKey: 'bottomNav.profile' },
];

/** Mobile-first sticky bottom navigation with a centered FAB for "Start walk". */
export default function BottomNav() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user) return null;

  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  const Item = ({ item }) => (
    <NavLink
      key={item.key}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `pp-bottomNav__item ${item.key === 'profile' ? 'pp-bottomNav__item--profile' : ''} ${
          isActive ? 'pp-bottomNav__item--on' : ''
        }`
      }
      aria-label={t(item.labelKey)}
      title={t(item.labelKey)}
    >
      <span className="pp-bottomNav__icon">{ICONS[item.key]}</span>
      <span className="pp-bottomNav__label">{t(item.labelKey)}</span>
      <span className="pp-bottomNav__activeDot" aria-hidden />
    </NavLink>
  );

  return (
    <nav className="pp-bottomNav" aria-label={t('bottomNav.aria')}>
      <div className="pp-bottomNav__row">
        {left.map((it) => (
          <Item key={it.key} item={it} />
        ))}
        <Link
          to="/dashboard#pp-walk-input-anchor"
          className="pp-bottomNav__fab"
          aria-label={t('bottomNav.fab')}
          title={t('bottomNav.fab')}
        >
          <span className="pp-bottomNav__fabIcon" aria-hidden>＋</span>
          <span className="pp-bottomNav__fabPulse" aria-hidden />
        </Link>
        {right.map((it) => (
          <Item key={it.key} item={it} />
        ))}
      </div>
    </nav>
  );
}
