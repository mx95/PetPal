import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { usePets } from '../pets/PetsContext';
import { useGame } from '../game/GameContext';
import { walkStreakDays, kmTodayForPetFromSessions, latestWalkSessionForPet } from '../walk/walkStats';
import PetCard from '../components/PetCard';
import ActivityCard from '../components/ActivityCard';
import UserAvatar from '../components/UserAvatar';
import { EmptyState, PageContainer, PetIllustration, PrimaryButton, SecondaryButton, StatCard } from '../components/ui';

function GreyIcon({ children, premium }) {
  return (
    <div
      className={['pp-homeTile__iconWrap', premium ? 'pp-homeTile__iconWrap--premium' : ''].filter(Boolean).join(' ')}
      aria-hidden
    >
      <svg className="pp-homeTile__iconSvg" viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
        {children}
      </svg>
    </div>
  );
}

const ICONS = {
  dashboard: (
    <>
      <rect x="4" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 14h16" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 21c1-3 16-3 17 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  pets: (
    <>
      <ellipse cx="9" cy="12" rx="3" ry="4" stroke="currentColor" strokeWidth="1.65" />
      <ellipse cx="15.5" cy="12.5" rx="2.5" ry="3" stroke="currentColor" strokeWidth="1.65" />
      <path d="M6 17c2 2 10 2 13 0" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </>
  ),
  community: (
    <>
      <path
        d="M8 17a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm8-10a4 4 0 1 1 0 8M8 21c0-4 10-4 16 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  leaderboard: (
    <>
      <rect x="4" y="14" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.65" />
      <rect x="9.5" y="9" width="5" height="11" rx="1" stroke="currentColor" strokeWidth="1.65" />
      <rect x="15" y="6" width="5" height="14" rx="1" stroke="currentColor" strokeWidth="1.65" />
    </>
  ),
  nearby: (
    <>
      <path
        d="M12 21s7-5.8 7-11a7 7 0 10-14 0c0 5.2 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  tracking: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.65" opacity="0.45" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.65" opacity="0.75" />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.35" stroke="none" />
    </>
  ),
  business: (
    <>
      <path d="M5 21V8l9-5 9 5v13" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M9 21v-8h11v8" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <circle cx="10" cy="12" r="1" fill="currentColor" opacity="0.65" stroke="none" />
    </>
  ),
  docs: (
    <>
      <path d="M7 21h14V8l-5.5-5H7v18z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M10 21V12h11" stroke="currentColor" strokeWidth="1.35" opacity="0.45" strokeLinecap="round" />
    </>
  ),
  admin: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.65" opacity="0.75" />
      <path d="M8 13h9M13 16h3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
    </>
  ),
};

const ICONS_PREMIUM = {
  lost: (
    <>
      <path d="M12 3 L20 17 H4 L12 3 Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M12 9v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" />
    </>
  ),
  stray: (
    <>
      <ellipse cx="9" cy="14" rx="3.5" ry="4" stroke="currentColor" strokeWidth="1.55" />
      <ellipse cx="16" cy="14.5" rx="3" ry="3.8" stroke="currentColor" strokeWidth="1.55" />
      <path d="M6 17c2 3 12 4 13 3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </>
  ),
  breeding: (
    <>
      <path
        d="M12 5c2 3 7 6 7 11a7 7 0 01-14 0c0-5 5-8 7-11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="14.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.35" />
    </>
  ),
};

function HomeTileLink({ iconChildren, iconPremium, accentKey, title, hint, locked, lockedHint, lockedAria, openAria, to }) {
  const cls = ['pp-homeTile', 'pp-homeTile--premium'];
  if (accentKey) cls.push(`pp-homeTile--accent-${accentKey}`);
  if (locked) cls.push('pp-homeTile--locked');

  const body = (
    <>
      <GreyIcon premium={iconPremium}>{iconChildren}</GreyIcon>
      <span className="pp-homeTile__title">{title}</span>
      {hint ? <span className="pp-homeTile__hint pp-homeTile__hint--premiumCard">{hint}</span> : null}
      {locked ? <span className="pp-homeTile__hint">{lockedHint}</span> : null}
    </>
  );

  if (locked) {
    return (
      <Link className={cls.join(' ')} to="/login" state={{ from: to }} aria-label={lockedAria}>
        {body}
      </Link>
    );
  }
  return (
    <Link className={cls.join(' ')} to={to} aria-label={openAria}>
      {body}
    </Link>
  );
}

function relativeTime(t, iso) {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.round(diff / 60000);
  if (m < 1) return t('home.feed.time.now');
  if (m < 60) return t('home.feed.time.minAgo', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('home.feed.time.hAgo', { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return t('home.feed.time.dAgo', { n: d });
  const w = Math.round(d / 7);
  return t('home.feed.time.wAgo', { n: w });
}

function LoggedInFeed() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin } = useCompany();
  const { pets } = usePets();
  const { walkLog, walkSessions, walkTotals, latestWalk, lifetimeAchievements, achievementCount, level } = useGame();

  const [petIdx, setPetIdx] = useState(0);
  const carouselRef = useRef(null);
  const scrollSyncRaf = useRef(null);
  const pet = pets[petIdx % Math.max(1, pets.length)] || null;

  const petsKey = useMemo(() => pets.map((p) => p.id).join(','), [pets]);

  const syncPetFromCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el || pets.length <= 1) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    let bestIdx = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const cr = child.getBoundingClientRect();
      if (cr.width <= 0) return;
      const mid = cr.left + cr.width / 2;
      const d = Math.abs(mid - centerX);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    setPetIdx((prev) => (prev !== bestIdx ? bestIdx : prev));
  }, [pets.length]);

  const onCarouselScroll = useCallback(() => {
    if (scrollSyncRaf.current != null) return;
    scrollSyncRaf.current = window.requestAnimationFrame(() => {
      scrollSyncRaf.current = null;
      syncPetFromCarouselScroll();
    });
  }, [syncPetFromCarouselScroll]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || pets.length <= 1) return;
    const opts = { passive: true };
    el.addEventListener('scroll', onCarouselScroll, opts);
    el.addEventListener('scrollend', onCarouselScroll);
    syncPetFromCarouselScroll();
    return () => {
      el.removeEventListener('scroll', onCarouselScroll);
      el.removeEventListener('scrollend', onCarouselScroll);
      if (scrollSyncRaf.current != null) {
        window.cancelAnimationFrame(scrollSyncRaf.current);
        scrollSyncRaf.current = null;
      }
    };
  }, [pets.length, petsKey, onCarouselScroll, syncPetFromCarouselScroll]);

  function scrollSlideIntoView(i) {
    const el = carouselRef.current?.children[i];
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  const greetingName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const streak = walkStreakDays(walkLog);
  const petsCount = pets.length;
  const latestWalkPet = useMemo(
    () => (pet?.id ? latestWalkSessionForPet(walkSessions, pet.id, petsCount) : null),
    [walkSessions, pet?.id, petsCount]
  );
  const todayKm = useMemo(
    () =>
      pet?.id
        ? kmTodayForPetFromSessions(walkSessions, pet.id, petsCount, walkTotals?.day || 0)
        : walkTotals?.day || 0,
    [walkSessions, pet?.id, petsCount, walkTotals?.day]
  );

  const recentSessions = useMemo(() => {
    if (!Array.isArray(walkSessions)) return [];
    return [...walkSessions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4);
  }, [walkSessions]);

  const recentEarned = useMemo(() => {
    if (!Array.isArray(lifetimeAchievements)) return [];
    return lifetimeAchievements.filter((a) => a.earned).slice(0, 3);
  }, [lifetimeAchievements]);

  const closestNext = useMemo(() => {
    if (!Array.isArray(lifetimeAchievements)) return null;
    const remaining = lifetimeAchievements.filter((a) => !a.earned);
    if (!remaining.length) return null;
    return [...remaining].sort((a, b) => b.progress - a.progress)[0];
  }, [lifetimeAchievements]);

  const tips = [
    { id: 'streak', emoji: '🔥', titleKey: 'home.feed.tips.streakTitle', descKey: 'home.feed.tips.streakDesc' },
    { id: 'photo', emoji: '📸', titleKey: 'home.feed.tips.photoTitle', descKey: 'home.feed.tips.photoDesc' },
    { id: 'nearby', emoji: '📍', titleKey: 'home.feed.tips.nearbyTitle', descKey: 'home.feed.tips.nearbyDesc' },
    { id: 'community', emoji: '🐾', titleKey: 'home.feed.tips.communityTitle', descKey: 'home.feed.tips.communityDesc' },
  ];

  const hasTracker = Boolean(pet?.trackingDeviceId?.trim?.());
  const statusKey =
    todayKm > 0
      ? 'active'
      : streak > 0 && latestWalkPet?.createdAt
        ? 'lastSeen'
        : hasTracker
          ? 'trackingHint'
          : 'noWalkToday';
  const statusValue =
    statusKey === 'active'
      ? `${(Math.round(todayKm * 10) / 10).toFixed(1)} km`
      : statusKey === 'lastSeen'
        ? relativeTime(t, latestWalkPet?.createdAt) || ''
        : '';

  const exploreItems = [
    { iconKey: 'community', titleKey: 'home.tileCommunity', to: '/community' },
    { iconKey: 'leaderboard', titleKey: 'home.tileLeaderboard', to: '/leaderboard' },
    { iconKey: 'nearby', titleKey: 'home.tileNearby', to: '/nearby' },
    { iconKey: 'tracking', titleKey: 'home.tileTracking', to: '/tracking' },
    { iconKey: 'pets', titleKey: 'home.tilePets', to: '/pets' },
    { iconKey: 'dashboard', titleKey: 'home.tileDashboard', to: '/dashboard' },
    { iconKey: 'business', titleKey: 'home.tileBusiness', to: '/company/apply' },
    { iconKey: 'docs', titleKey: 'home.tileDocs', to: '/docs' },
    ...(isAdmin ? [{ iconKey: 'admin', titleKey: 'home.tileAdmin', to: '/admin' }] : []),
  ];

  return (
    <div className="pp-feed">
      <header className="pp-feed__hello">
        <div className="pp-feed__helloMain">
          <UserAvatar user={user} size={48} className="pp-feed__userAvatar" />
          <div className="pp-feed__helloCopy">
            <span className="pp-feed__eyebrow">{t('home.feed.eyebrow')}</span>
            <h1 className="pp-feed__title">
              {greetingName ? t('home.feed.helloName', { name: greetingName }) : t('home.feed.helloAnon')}
            </h1>
            <p className="pp-feed__sub">
              {pet
                ? t('home.feed.subWithPet', { name: pet.name })
                : t('home.feed.subNoPet')}
            </p>
          </div>
        </div>
        <div className="pp-feed__pills">
          {streak > 0 ? (
            <span className="pp-feed__pill pp-feed__pill--streak">
              {t('home.feed.streakChip', { n: streak })}
            </span>
          ) : (
            <span className="pp-feed__pill pp-feed__pill--ghost">
              {t('home.feed.streakStart')}
            </span>
          )}
          <span className="pp-feed__pill pp-feed__pill--level">
            {t('home.feed.levelChip', { n: level })}
          </span>
          {achievementCount > 0 ? (
            <span className="pp-feed__pill pp-feed__pill--ach">
              {t('home.feed.badgesChip', { n: achievementCount })}
            </span>
          ) : null}
        </div>
      </header>

      {pet ? (
        <section aria-label={t('home.feed.petCardAria')}>
          <div
            ref={carouselRef}
            className="pp-petCarousel"
            aria-label={t('home.feed.switchPet')}
          >
            {pets.map((p, i) => {
              const active = i === petIdx % pets.length;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className={`pp-petCarousel__slide ${active ? 'pp-petCarousel__slide--active' : ''}`}
                  onClick={() => {
                    setPetIdx(i);
                    scrollSlideIntoView(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setPetIdx(i);
                      scrollSlideIntoView(i);
                    }
                  }}
                  aria-label={p.name}
                  aria-current={active ? 'true' : undefined}
                >
                  <PetCard
                    pet={p}
                    statusKey={active ? statusKey : 'resting'}
                    statusValue={active ? statusValue : ''}
                    onStartWalk={() => {
                      window.location.assign('/dashboard#pp-walk-input-anchor');
                    }}
                  />
                </div>
              );
            })}
          </div>
          {pets.length > 1 ? (
            <div className="pp-feed__petDots" role="tablist" aria-label={t('home.feed.switchPet')}>
              {pets.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === petIdx % pets.length}
                  className={`pp-feed__petDot ${i === petIdx % pets.length ? 'pp-feed__petDot--on' : ''}`}
                  onClick={() => {
                    setPetIdx(i);
                    scrollSlideIntoView(i);
                  }}
                  aria-label={p.name}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <EmptyState title={t('home.feed.noPetTitle')} body={t('home.feed.noPetSub')} actionLabel={t('home.feed.noPetCta')} actionTo="/pets#add-pet" />
      )}

      <section className="pp-feed__section">
        <div className="pp-feed__sectionHead">
          <h2 className="pp-feed__sectionTitle">{t('home.feed.discoverTitle')}</h2>
        </div>
        <div className="pp-discover">
          {exploreItems.map((it) => (
            <Link key={it.to} className={`pp-discoverChip pp-discoverChip--${it.iconKey}`} to={it.to}>
              <GreyIcon>{ICONS[it.iconKey]}</GreyIcon>
              <span className="pp-discoverChip__label">{t(it.titleKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pp-feed__section">
        <div className="pp-feed__sectionHead">
          <span className="pp-badge pp-badge--premium">{t('premium.badge')}</span>
          <h2 className="pp-feed__sectionTitle" style={{ flex: 1 }}>{t('premium.title')}</h2>
        </div>
        <p className="pp-subtle" style={{ margin: '0 0 12px' }}>{t('premium.subtitle')}</p>
        <div className="pp-homeGrid pp-homeGrid--premiumSub">
          {[
            { iconKey: 'lost', titleKey: 'premium.tabLost', hintKey: 'home.premiumCardLostHint', to: '/premium/lost' },
            { iconKey: 'stray', titleKey: 'premium.tabStray', hintKey: 'home.premiumCardStrayHint', to: '/premium/stray' },
            { iconKey: 'breeding', titleKey: 'premium.tabBreeding', hintKey: 'home.premiumCardBreedingHint', to: '/premium/breeding' },
          ].map(({ iconKey, titleKey, hintKey, to }) => (
            <HomeTileLink
              key={to}
              iconChildren={ICONS_PREMIUM[iconKey]}
              iconPremium
              accentKey={iconKey}
              title={t(titleKey)}
              hint={t(hintKey)}
              locked={false}
              openAria={t(titleKey)}
              to={to}
            />
          ))}
        </div>
      </section>

      <section className="pp-feed__section">
        <div className="pp-feed__sectionHead">
          <h2 className="pp-feed__sectionTitle">{t('home.feed.continueTitle')}</h2>
          <Link className="pp-feed__sectionLink" to="/dashboard">
            {t('home.feed.openDashboard')}
          </Link>
        </div>
        <div className="pp-feed__row">
          {latestWalk ? (
            <ActivityCard
              accent="walk"
              icon="🚶"
              eyebrow={t('home.feed.eyebrowResume')}
              title={t('home.feed.resumeWalkTitle', { km: (Math.round(latestWalk.km * 10) / 10).toFixed(1) })}
              subtitle={t('home.feed.resumeWalkSub')}
              meta={relativeTime(t, latestWalk.createdAt) || ''}
              to="/dashboard#pp-walk-input-anchor"
              thumb={latestWalk.photos && latestWalk.photos[0]}
            />
          ) : (
            <ActivityCard
              accent="walk"
              icon="✨"
              eyebrow={t('home.feed.eyebrowStart')}
              title={t('home.feed.firstWalkTitle')}
              subtitle={t('home.feed.firstWalkSub')}
              to="/dashboard#pp-walk-input-anchor"
            />
          )}
          {closestNext ? (
            <ActivityCard
              accent="achievement"
              icon="🎯"
              eyebrow={t('home.feed.eyebrowGoal')}
              title={t(`lifetime.ach.${closestNext.id}.label`)}
              subtitle={t('home.feed.goalSub', { pct: Math.round(closestNext.progress * 100) })}
              meta={`+${closestNext.xp} XP`}
              to="/dashboard"
            />
          ) : null}
        </div>
      </section>

      {recentSessions.length > 0 || recentEarned.length > 0 ? (
        <section className="pp-feed__section">
          <div className="pp-feed__sectionHead">
            <h2 className="pp-feed__sectionTitle">{t('home.feed.recentTitle')}</h2>
          </div>
          <div className="pp-feed__row">
            {recentSessions.map((s) => (
              <ActivityCard
                key={s.id}
                accent="walk"
                icon="🐾"
                eyebrow={t('home.feed.eyebrowWalk')}
                title={t('home.feed.recentWalkTitle', { km: (Math.round(s.km * 10) / 10).toFixed(1) })}
                subtitle={
                  s.photos && s.photos.length
                    ? s.photos.length === 1
                      ? t('home.feed.recentWalkPhotosOne')
                      : t('home.feed.recentWalkPhotos', { n: s.photos.length })
                    : t('home.feed.recentWalkNoPhotos')
                }
                meta={relativeTime(t, s.createdAt) || ''}
                thumb={s.photos && s.photos[0]}
                to="/dashboard"
              />
            ))}
            {recentEarned.map((a) => (
              <ActivityCard
                key={`ach-${a.id}`}
                accent="achievement"
                icon="🏅"
                eyebrow={t('home.feed.eyebrowAch')}
                title={t(`lifetime.ach.${a.id}.label`)}
                subtitle={t(`lifetime.cat.${a.kind}`)}
                meta={`+${a.xp} XP`}
                to="/dashboard"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="pp-feed__section">
        <div className="pp-feed__sectionHead">
          <h2 className="pp-feed__sectionTitle">{t('home.feed.tipsTitle')}</h2>
        </div>
        <div className="pp-feed__row">
          {tips.map((tip) => (
            <ActivityCard
              key={tip.id}
              accent="tip"
              icon={tip.emoji}
              eyebrow={t('home.feed.eyebrowTip')}
              title={t(tip.titleKey)}
              subtitle={t(tip.descKey)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PublicHero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-lift backdrop-blur animate-fade-up sm:p-10 lg:p-12" aria-labelledby="public-hero-title">
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-petpal-soft blur-3xl" aria-hidden />
      <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-petpal-cream blur-3xl" aria-hidden />
      <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <span className="mb-4 inline-flex rounded-full bg-petpal-soft px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-petpal-lilac">{t('home.publicHero.eyebrow')}</span>
          <h1 id="public-hero-title" className="max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.06em] text-petpal-ink sm:text-6xl">
            {t('home.publicHero.headline')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-petpal-muted">{t('home.publicHero.sub')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryButton to="/register">{t('home.publicHero.ctaPrimary')}</PrimaryButton>
            <SecondaryButton to="/login">{t('home.publicHero.ctaSecondary')}</SecondaryButton>
          </div>
          <p className="mt-5 text-sm font-bold text-slate-400">{t('home.publicHero.trustLine')}</p>
        </div>
        <div className="relative">
          <div className="mx-auto max-w-sm rounded-[2rem] bg-gradient-to-br from-petpal-soft via-white to-petpal-cream p-6 shadow-lift">
            <PetIllustration className="mx-auto h-52 w-52" />
            <ul className="mt-4 space-y-3" aria-label="Highlights">
          <li className="flex gap-3 rounded-3xl bg-white/85 p-4 shadow-soft">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-petpal-soft" aria-hidden>Pets</span>
            <div>
              <strong className="block text-sm font-black text-petpal-ink">{t('home.publicHero.bullet1Title')}</strong>
              <span className="text-sm leading-6 text-petpal-muted">{t('home.publicHero.bullet1Desc')}</span>
            </div>
          </li>
          <li className="flex gap-3 rounded-3xl bg-white/85 p-4 shadow-soft">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50" aria-hidden>Lost</span>
            <div>
              <strong className="block text-sm font-black text-petpal-ink">{t('home.publicHero.bullet2Title')}</strong>
              <span className="text-sm leading-6 text-petpal-muted">{t('home.publicHero.bullet2Desc')}</span>
            </div>
          </li>
          <li className="flex gap-3 rounded-3xl bg-white/85 p-4 shadow-soft">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50" aria-hidden>Map</span>
            <div>
              <strong className="block text-sm font-black text-petpal-ink">{t('home.publicHero.bullet3Title')}</strong>
              <span className="text-sm leading-6 text-petpal-muted">{t('home.publicHero.bullet3Desc')}</span>
            </div>
          </li>
        </ul>
          </div>
        </div>
      </div>
      <div className="relative mt-8 grid gap-4 sm:grid-cols-3" role="list">
        <StatCard value={t('home.publicHero.stat1')} label={t('home.publicHero.stat1Desc')} />
        <StatCard value={t('home.publicHero.stat2')} label={t('home.publicHero.stat2Desc')} tone="mint" />
        <StatCard value={t('home.publicHero.stat3')} label={t('home.publicHero.stat3Desc')} tone="gold" />
      </div>
    </section>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();

  if (!user) {
    return (
      <PageContainer>
        <PublicHero />
      </PageContainer>
    );
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <LoggedInFeed />
      </div>
    </div>
  );
}
