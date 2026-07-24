import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { usePets } from '../pets/PetsContext';
import DiscoverHero from './DiscoverHero';
import DiscoverQuickActions from './DiscoverQuickActions';
import DiscoverFeedCard from './DiscoverFeedCard';
import DiscoverFeedSkeleton from './DiscoverFeedSkeleton';
import DiscoverCommunityCarousel from './DiscoverCommunityCarousel';
import DiscoverServices from './DiscoverServices';
import DiscoverTrustStrip from './DiscoverTrustStrip';
import DiscoverPromoteModal from './DiscoverPromoteModal';
import { useDiscoverFeed } from './useDiscoverFeed';

export default function DiscoverHome() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { pets } = usePets();
  const { profile, isApprovedCompany } = useCompany();
  const { items, loading, loadingMore, hasMore, error, loadMore, refresh } = useDiscoverFeed({ t });
  const [promoteOpen, setPromoteOpen] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '240px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return (
    <div className="pp-discoverPage">
      <DiscoverHero user={user} pets={pets} />
      <DiscoverQuickActions />

      <div className="pp-discoverPage__layout">
        <main className="pp-discoverPage__main">
          <div className="pp-dSectionHead pp-dSectionHead--feed">
            <div>
              <h2 className="pp-dSectionHead__title">{t('discover.feed.title')}</h2>
              <p className="pp-dSectionHead__sub">{t('discover.feed.sub')}</p>
            </div>
            <div className="pp-dSectionHead__actions">
              {isApprovedCompany ? (
                <button type="button" className="pp-dSectionHead__link pp-dSectionHead__linkBtn" onClick={() => setPromoteOpen(true)}>
                  {t('discover.feed.promote')}
                </button>
              ) : null}
              <button type="button" className="pp-dSectionHead__link pp-dSectionHead__linkBtn" onClick={refresh}>
                {t('discover.feed.refresh')}
              </button>
              <Link className="pp-dSectionHead__link" to="/community">
                {t('discover.feed.postCta')}
              </Link>
            </div>
          </div>

          <div className="pp-discoverPage__feed">
            {loading ? <DiscoverFeedSkeleton count={3} /> : null}
            {!loading && error ? (
              <p className="pp-discoverPage__feedErr" role="alert">
                {error}
              </p>
            ) : null}
            {!loading && !error && items.length === 0 ? (
              <div className="pp-discoverPage__empty">
                <span aria-hidden>🐾</span>
                <p>{t('discover.feed.empty')}</p>
              </div>
            ) : null}
            {items.map((item) => (
              <DiscoverFeedCard key={item.id} item={item} />
            ))}
            {loadingMore ? <DiscoverFeedSkeleton count={1} /> : null}
            {hasMore ? <div ref={sentinelRef} className="pp-discoverPage__sentinel" aria-hidden /> : null}
          </div>
        </main>

        <aside className="pp-discoverPage__aside">
          <DiscoverCommunityCarousel pets={pets} />
          <DiscoverServices />
        </aside>
      </div>

      <DiscoverTrustStrip loggedIn={Boolean(user)} />

      {!user ? (
        <section className="pp-dOnboard">
          <h2>{t('discover.onboard.title')}</h2>
          <p>{t('discover.onboard.sub')}</p>
          <div className="pp-dOnboard__cta">
            <Link className="pp-btn pp-btnPrimary" to="/register">
              {t('discover.onboard.join')}
            </Link>
            <Link className="pp-btn pp-btn--ghost" to="/login">
              {t('discover.onboard.signIn')}
            </Link>
          </div>
        </section>
      ) : null}

      <DiscoverPromoteModal
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        companyProfile={profile}
        uid={user?.uid}
        onPosted={refresh}
      />
    </div>
  );
}
