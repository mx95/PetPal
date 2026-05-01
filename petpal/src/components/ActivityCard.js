import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Compact "thing that just happened" card for the home feed.
 *
 * @param {{
 *   icon?: React.ReactNode,
 *   eyebrow?: string,
 *   title: string,
 *   subtitle?: string,
 *   thumb?: string,
 *   meta?: string,
 *   to?: string,
 *   accent?: 'walk'|'achievement'|'tip'|'alert',
 *   onClick?: () => void,
 * }} props
 */
export default function ActivityCard({
  icon,
  eyebrow,
  title,
  subtitle,
  thumb,
  meta,
  to,
  accent = 'walk',
  onClick,
}) {
  const cls = `pp-activityCard pp-activityCard--${accent}`;

  const inner = (
    <>
      {thumb ? (
        <div className="pp-activityCard__thumb" style={{ backgroundImage: `url(${thumb})` }} aria-hidden />
      ) : (
        <div className="pp-activityCard__icon" aria-hidden>{icon || '✨'}</div>
      )}
      <div className="pp-activityCard__body">
        {eyebrow ? <span className="pp-activityCard__eyebrow">{eyebrow}</span> : null}
        <span className="pp-activityCard__title">{title}</span>
        {subtitle ? <span className="pp-activityCard__sub">{subtitle}</span> : null}
      </div>
      {meta ? <span className="pp-activityCard__meta">{meta}</span> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
