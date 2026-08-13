import React from 'react';
import { Link } from 'react-router-dom';
import PetAvatar from './PetAvatar';
import { useI18n } from '../i18n/I18nContext';

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 13.5a7.4 7.4 0 0 0 .1-3l2-1.2-2-3.5-2.3 1a7.6 7.6 0 0 0-2.6-1.5L14.5 2h-5L9.4 5.3a7.6 7.6 0 0 0-2.6 1.5l-2.3-1-2 3.5 2 1.2a7.4 7.4 0 0 0 .1 3l-2 1.2 2 3.5 2.3-1a7.6 7.6 0 0 0 2.6 1.5L9.5 22h5l.5-3.3a7.6 7.6 0 0 0 2.6-1.5l2.3 1 2-3.5-2-1.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Hero card for a single pet. Shows a large avatar, friendly status,
 * and quick-action buttons (Track / Manage / Alert).
 *
 * @param {{
 *   pet: { id: string, name: string, categoryId: string, photoDataUrl?: string, age?: string, colorScheme?: string },
 *   statusKey?: 'active'|'resting'|'lastSeen'|'noWalkToday'|'firstWalk'|'trackingHint',
 *   statusValue?: string,
 * }} props
 */
export default function PetCard({ pet, statusKey, statusValue }) {
  const { t } = useI18n();
  if (!pet) return null;

  const subtitle = [pet.age, pet.colorScheme].filter(Boolean).join(' · ');

  const status = statusKey ? t(`home.feed.status.${statusKey}`, { value: statusValue || '' }) : null;

  return (
    <article className="pp-petCard" aria-labelledby={`pp-petCard-${pet.id}-name`}>
      <div className="pp-petCard__shine" aria-hidden />
      <div className="pp-petCard__avatarWrap">
        <PetAvatar pet={pet} size={86} className="pp-petCard__avatar" />
      </div>
      <div className="pp-petCard__body">
        <span className="pp-petCard__greeting">
          {t('home.feed.greeting', { name: pet.name })}
        </span>
        <h3 id={`pp-petCard-${pet.id}-name`} className="pp-petCard__name">
          {pet.name}
        </h3>
        {subtitle ? <p className="pp-petCard__sub">{subtitle}</p> : null}
        {status ? (
          <span className={`pp-petCard__status pp-petCard__status--${statusKey || 'default'}`}>
            <span className="pp-petCard__statusDot" aria-hidden />
            {status}
          </span>
        ) : null}
      </div>
      <div className="pp-petCard__actions" role="group" aria-label={pet.name}>
        <Link className="pp-quickAction pp-quickAction--track" to="/tracking" aria-label={t('home.feed.quickTrack')}>
          <span className="pp-quickAction__icon" aria-hidden>📡</span>
          <span className="pp-quickAction__label">{t('home.feed.quickTrack')}</span>
        </Link>
        <Link
          className="pp-quickAction pp-quickAction--manage"
          to={`/pets?pet=${encodeURIComponent(pet.id)}`}
          aria-label={t('home.feed.quickManage')}
        >
          <span className="pp-quickAction__icon">
            <IconGear />
          </span>
          <span className="pp-quickAction__label">{t('home.feed.quickManage')}</span>
        </Link>
        <button
          type="button"
          className="pp-quickAction pp-quickAction--alert pp-quickAction--disabled"
          disabled
          aria-disabled="true"
          aria-label={t('home.feed.quickAlert')}
          title={t('home.feed.quickAlert')}
        >
          <span className="pp-quickAction__icon" aria-hidden>🚨</span>
          <span className="pp-quickAction__label">{t('home.feed.quickAlert')}</span>
        </button>
      </div>
    </article>
  );
}
