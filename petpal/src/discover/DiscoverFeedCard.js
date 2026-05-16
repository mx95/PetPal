import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { contactDiscoverItem, shareDiscoverItem } from './discoverFeedActions';

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
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

/**
 * @param {{ item: Record<string, unknown> }} props
 */
export default function DiscoverFeedCard({ item }) {
  const { t } = useI18n();
  const [liked, setLiked] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const likes = item.likes + (liked ? 1 : 0);

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
        <div className="pp-dFeedCard__avatar" style={{ background: item.imageGradient }} aria-hidden>
          {item.authorLogo}
        </div>
        <div className="pp-dFeedCard__meta">
          <div className="pp-dFeedCard__authorRow">
            <span className="pp-dFeedCard__author">{item.authorName}</span>
            {item.verified ? (
              <span className="pp-dFeedCard__verified" title={t('discover.feed.verified')}>
                ✓ {t('discover.feed.verified')}
              </span>
            ) : null}
            {item.sponsored ? <span className="pp-dFeedCard__sponsored">{t('discover.feed.sponsored')}</span> : null}
          </div>
          <span className="pp-dFeedCard__time">
            {relativeTime(t, item.createdAt)}
            {item.distanceKm != null ? ` · ${t('discover.feed.distance', { km: item.distanceKm.toFixed(1) })}` : ''}
          </span>
        </div>
      </header>

      <div className="pp-dFeedCard__banner" style={{ background: item.imageGradient }}>
        <span className="pp-dFeedCard__bannerEmoji" aria-hidden>
          {item.authorLogo}
        </span>
      </div>

      <div className="pp-dFeedCard__body">
        <h3 className="pp-dFeedCard__title">{item.title}</h3>
        <p className="pp-dFeedCard__text">{item.body}</p>
        <div className="pp-dFeedCard__actions">
          {item.ctaTo ? (
            <Link className="pp-btn pp-btnPrimary pp-dFeedCard__cta" to={item.ctaTo}>
              {t(item.ctaLabelKey)}
            </Link>
          ) : null}
          <button type="button" className="pp-btn pp-btn--ghost pp-dFeedCard__contact" onClick={onContact}>
            {t('discover.feed.contact')}
          </button>
        </div>
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
