import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

/** Core shortcuts — kept minimal so the feed stays the focal point. */
const ACTIONS = [
  { key: 'vets', icon: '🏥', to: '/nearby', labelKey: 'discover.actions.vets' },
  { key: 'book', icon: '📅', to: '/bookings', labelKey: 'discover.actions.bookings' },
  { key: 'walk', icon: '🚶', to: '/dashboard', labelKey: 'discover.actions.walk' },
  { key: 'pack', icon: '💬', to: '/community', labelKey: 'discover.actions.community' },
  { key: 'lost', icon: '🆘', to: '/premium/lost', labelKey: 'discover.actions.lost' },
];

export default function DiscoverQuickActions() {
  const { t } = useI18n();
  return (
    <section className="pp-dQuick" aria-label={t('discover.actions.aria')}>
      <div className="pp-dQuick__scroll">
        {ACTIONS.map((a) => (
          <Link key={a.key} className="pp-dQuick__pill" to={a.to}>
            <span className="pp-dQuick__icon" aria-hidden>
              {a.icon}
            </span>
            <span className="pp-dQuick__label">{t(a.labelKey)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
