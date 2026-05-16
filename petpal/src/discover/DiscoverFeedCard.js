import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { contactDiscoverItem, shareDiscoverItem } from './discoverFeedActions';

function formatCount(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return '0';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function relativeTime(t, iso) {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.round(diff / 60000);
  if (m < 60) return t('home.feed.time.minAgo', { n: Math.max(1, m) });
  const h = Math.round(m / 60);
  if (h < 24) return t('home.feed.time.hAgo', { n: h });
  return t('home.feed.time.dAgo', { n: Math.round(h / 24) });
}

function showMediaBanner(item) {
  return item.type === 'business' || item.type === 'event' || item.type === 'adoption';
}

/**
 * @param {{ item: Record<string, unknown> }} props
 */
export default function DiscoverFeedCard({ item }) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const likes = (Number(item.likes) || 0) + (liked ? 1 : 0);
  const hasBanner = showMediaBanner(item);

  async function onShare() {
    const res = await shareDiscoverItem(item, t);
    if (res.message) {
      setShareNote(res.message);
      window.setTimeout(() => setShareNote(''), 2800);
    }
  }

  function onContact() {
    const channel = contactDiscoverItem(item);
    if (!channel) {
      setShareNote(t('discover.feed.contactUnavailable'));
      window.setTimeout(() => setShareNote(''), 2800);
    }
  }

  return (
    <article className="pp-dFeedCard">
      <header className="pp-dFeedCard__head">
        <div
          className="pp-dFeedCard__avatar"
          style={hasBanner ? undefined : { background: item.imageGradient || 'rgba(91, 55, 255, 0.12)' }}
          aria-hidden
        >
          {item.authorLogo}
        </div>
        <div className="pp-dFeedCard__meta">
          <div className="pp-dFeedCard__authorRow">
            <span className="pp-dFeedCard__author">{item.authorName}</span>
            {item.verified ? <span className="pp-dFeedCard__verified">✓</span> : null}
            {item.sponsored ? <span className="pp-dFeedCard__sponsored">{t('discover.feed.sponsored')}</span> : null}
          </div>
          <span className="pp-dFeedCard__time">
            {relativeTime(t, item.createdAt)}
            {item.distanceKm != null ? ` · ${t('discover.feed.distance', { km: Number(item.distanceKm).toFixed(1) })}` : ''}
          </span>
        </div>
      </header>

      {hasBanner ? (
        <div className="pp-dFeedCard__banner" style={{ background: item.imageGradient }}>
          <span className="pp-dFeedCard__bannerEmoji" aria-hidden>
            {item.authorLogo}
          </span>
        </div>
      ) : null}

      <div className="pp-dFeedCard__body">
        <h3 className="pp-dFeedCard__title">{item.title}</h3>
        <p className="pp-dFeedCard__text">{item.body}</p>
        {item.ctaTo ? (
          <div className="pp-dFeedCard__actions">
            <Link className="pp-btn pp-btnPrimary pp-dFeedCard__cta" to={item.ctaTo}>
              {t(item.ctaLabelKey)}
            </Link>
            <button type="button" className="pp-dFeedCard__linkBtn" onClick={onContact}>
              {t('discover.feed.contact')}
            </button>
          </div>
        ) : null}
        {shareNote ? (
          <p className="pp-dFeedCard__toast" role="status">
            {shareNote}
          </p>
        ) : null}
      </div>

      <footer className="pp-dFeedCard__foot">
        <button
          type="button"
          className={`pp-dFeedCard__engage${liked ? ' is-on' : ''}`}
          onClick={() => setLiked((v) => !v)}
          aria-pressed={liked}
        >
          ♥ {formatCount(likes)}
        </button>
        <Link to="/community" className="pp-dFeedCard__engage">
          💬 {formatCount(item.comments)}
        </Link>
        <button type="button" className="pp-dFeedCard__engage" onClick={onShare}>
          ↗ {t('discover.feed.share')}
        </button>
      </footer>
    </article>
  );
}
