import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nContext';
import { telHref } from '../../media/photoUploadUtils';

/**
 * Large photo-first card for feeds.
 * @param {{
 *   photoUrl?: string,
 *   placeholderEmoji?: string,
 *   statusLabel: string,
 *   statusTone?: 'lost' | 'found' | 'available' | 'shelter',
 *   title: string,
 *   subtitle?: string,
 *   metaLines?: string[],
 *   description?: string,
 *   detailHref?: string,
 *   phone?: string,
 *   onShare?: () => void,
 *   secondaryAction?: { label: string, href?: string, onClick?: () => void },
 * }} props
 */
export default function PhotoFeedCard({
  photoUrl,
  placeholderEmoji = '🐾',
  statusLabel,
  statusTone = 'lost',
  title,
  subtitle,
  metaLines = [],
  description,
  detailHref,
  phone,
  onShare,
  secondaryAction,
}) {
  const { t } = useI18n();
  const tel = telHref(phone);

  return (
    <article className={`pp-photoFeedCard pp-photoFeedCard--${statusTone}`}>
      <div className="pp-photoFeedCard__media">
        {photoUrl ? (
          <img src={photoUrl} alt="" loading="lazy" className="pp-photoFeedCard__img" />
        ) : (
          <div className="pp-photoFeedCard__placeholder" aria-hidden>
            {placeholderEmoji}
          </div>
        )}
        <span className="pp-photoFeedCard__status">{statusLabel}</span>
      </div>
      <div className="pp-photoFeedCard__body">
        <h3 className="pp-photoFeedCard__title">{title}</h3>
        {subtitle ? <p className="pp-photoFeedCard__subtitle">{subtitle}</p> : null}
        {metaLines.map((line) => (
          <p key={line} className="pp-photoFeedCard__meta">
            {line}
          </p>
        ))}
        {description ? <p className="pp-photoFeedCard__desc">{description}</p> : null}
        <div className="pp-photoFeedCard__actions">
          {detailHref ? (
            <Link className="pp-btn pp-btnPrimary" to={detailHref}>
              {t('photos.viewDetails')}
            </Link>
          ) : null}
          {tel ? (
            <a className="pp-btn" href={tel}>
              {t('photos.call')}
            </a>
          ) : null}
          {secondaryAction?.href ? (
            <Link className="pp-btn" to={secondaryAction.href}>
              {secondaryAction.label}
            </Link>
          ) : secondaryAction?.onClick ? (
            <button type="button" className="pp-btn" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          ) : null}
          {onShare ? (
            <button type="button" className="pp-btn pp-btnGhost" onClick={onShare}>
              {t('photos.share')}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
