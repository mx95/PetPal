import React from 'react';
import { Link } from 'react-router-dom';
import PetAvatar from './PetAvatar';
import { useI18n } from '../i18n/I18nContext';

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
          <span className="pp-quickAction__icon" aria-hidden>
            <img className="pp-quickAction__img" src={`${process.env.PUBLIC_URL || ''}/ui-icons/action-track.png`} alt="" width="44" height="44" decoding="async" />
          </span>
          <span className="pp-quickAction__label">{t('home.feed.quickTrack')}</span>
        </Link>
        <Link
          className="pp-quickAction pp-quickAction--manage"
          to={`/pets?pet=${encodeURIComponent(pet.id)}`}
          aria-label={t('home.feed.quickManage')}
        >
          <span className="pp-quickAction__icon" aria-hidden>
            <img className="pp-quickAction__img" src={`${process.env.PUBLIC_URL || ''}/ui-icons/action-manage.png`} alt="" width="44" height="44" decoding="async" />
          </span>
          <span className="pp-quickAction__label">{t('home.feed.quickManage')}</span>
        </Link>
        <Link
          className="pp-quickAction pp-quickAction--alert"
          to={`/tracking?pet=${encodeURIComponent(pet.id)}&tab=zone`}
          aria-label={t('home.feed.quickAlert')}
          title={t('home.feed.quickAlert')}
        >
          <span className="pp-quickAction__icon" aria-hidden>
            <img className="pp-quickAction__img" src={`${process.env.PUBLIC_URL || ''}/ui-icons/action-alert.png`} alt="" width="44" height="44" decoding="async" />
          </span>
          <span className="pp-quickAction__label">{t('home.feed.quickAlert')}</span>
        </Link>
      </div>
    </article>
  );
}
