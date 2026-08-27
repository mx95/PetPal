import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { isBookingBrowseEnabled } from '../bookings/bookingFeature';

const ACTIONS = [
  { key: 'vets', icon: '🏥', to: '/nearby', labelKey: 'discover.actions.vets' },
  { key: 'groom', icon: '✂️', to: '/nearby', labelKey: 'discover.actions.groomers' },
  { key: 'shops', icon: '🛒', to: '/shop', labelKey: 'discover.actions.shops' },
  { key: 'lost', icon: '🆘', to: '/lost-pet', labelKey: 'discover.actions.lost' },
  { key: 'book', icon: '📅', to: '/bookings', labelKey: 'discover.actions.bookings', browseOnly: true },
  { key: 'walk', icon: '🚶', to: '/dashboard', labelKey: 'discover.actions.walk' },
  { key: 'pack', icon: '💬', to: '/community', labelKey: 'discover.actions.community' },
  { key: 'sos', icon: '⚡', to: '/lost-pet', labelKey: 'discover.actions.emergency' },
];

export default function DiscoverQuickActions() {
  const { t } = useI18n();
  const browseEnabled = isBookingBrowseEnabled();
  const actions = ACTIONS.filter((a) => !a.browseOnly || browseEnabled);
  return (
    <section className="pp-dQuick" aria-label={t('discover.actions.aria')}>
      <div className="pp-dQuick__scroll">
        {actions.map((a) => (
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
