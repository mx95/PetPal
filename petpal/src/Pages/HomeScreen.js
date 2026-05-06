import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { usePets } from '../pets/PetsContext';
import { useGame } from '../game/GameContext';
import { walkStreakDays } from '../walk/walkStats';
import PetCard from '../components/PetCard';
import ActivityCard from '../components/ActivityCard';
import UserAvatar from '../components/UserAvatar';

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
  const { walkLog, walkSessions, latestWalk, lifetimeAchievements, achievementCount, level } = useGame();

  const [petIdx, setPetIdx] = useState(0);
  const pet = pets[petIdx % Math.max(1, pets.length)] || null;

  const greetingName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const streak = walkStreakDays(walkLog);
  const todayKm = useMemo(() => {
    if (!walkLog || typeof walkLog !== 'object') return 0;
    const today = new Date().toISOString().slice(0, 10);
    return Math.max(0, Number(walkLog[today]) || 0);
  }, [walkLog]);

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

  const statusKey = todayKm > 0 ? 'active' : streak > 0 ? 'lastSeen' : 'noWalkToday';
  const statusValue =
    statusKey === 'active'
      ? `${(Math.round(todayKm * 10) / 10).toFixed(1)} km`
      : statusKey === 'lastSeen'
        ? relativeTime(t, latestWalk?.createdAt) || ''
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
          <PetCard pet={pet} statusKey={statusKey} statusValue={statusValue} onStartWalk={() => {
            window.location.assign('/dashboard#pp-walk-input-anchor');
          }} />
          {pets.length > 1 ? (
            <div className="pp-feed__petDots" role="tablist" aria-label={t('home.feed.switchPet')}>
              {pets.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={i === petIdx % pets.length}
                  className={`pp-feed__petDot ${i === petIdx % pets.length ? 'pp-feed__petDot--on' : ''}`}
                  onClick={() => setPetIdx(i)}
                  aria-label={p.name}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="pp-feed__addPet">
          <div className="pp-feed__addPetCopy">
            <span aria-hidden style={{ fontSize: 36 }}>🐶</span>
            <h2 className="pp-feed__addPetTitle">{t('home.feed.noPetTitle')}</h2>
            <p className="pp-feed__addPetSub">{t('home.feed.noPetSub')}</p>
          </div>
          <Link className="pp-btn pp-btnPrimary pp-btn--lg" to="/pets#add-pet">
            {t('home.feed.noPetCta')}
          </Link>
        </section>
      )}

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
    </div>
  );
}

function PublicHero() {
  const { t } = useI18n();
  return (
    <section className="pp-publicHero" aria-labelledby="public-hero-title">
      <div className="pp-publicHero__inner">
        <div className="pp-publicHero__copy">
          <span className="pp-publicHero__eyebrow">{t('home.publicHero.eyebrow')}</span>
          <h1 id="public-hero-title" className="pp-publicHero__headline">
            {t('home.publicHero.headline')}
          </h1>
          <p className="pp-publicHero__sub">{t('home.publicHero.sub')}</p>
          <div className="pp-publicHero__ctaRow">
            <Link className="pp-btn pp-btnPrimary pp-btn--lg" to="/register">
              {t('home.publicHero.ctaPrimary')}
            </Link>
            <Link className="pp-btn pp-btn--lg pp-btn--ghost" to="/login">
              {t('home.publicHero.ctaSecondary')}
            </Link>
          </div>
          <p className="pp-publicHero__trust">{t('home.publicHero.trustLine')}</p>
        </div>
        <ul className="pp-publicHero__bullets" aria-label="Highlights">
          <li>
            <span className="pp-publicHero__bulletIcon" aria-hidden>🐾</span>
            <div>
              <strong>{t('home.publicHero.bullet1Title')}</strong>
              <span>{t('home.publicHero.bullet1Desc')}</span>
            </div>
          </li>
          <li>
            <span className="pp-publicHero__bulletIcon" aria-hidden>🚨</span>
            <div>
              <strong>{t('home.publicHero.bullet2Title')}</strong>
              <span>{t('home.publicHero.bullet2Desc')}</span>
            </div>
          </li>
          <li>
            <span className="pp-publicHero__bulletIcon" aria-hidden>📍</span>
            <div>
              <strong>{t('home.publicHero.bullet3Title')}</strong>
              <span>{t('home.publicHero.bullet3Desc')}</span>
            </div>
          </li>
        </ul>
      </div>
      <div className="pp-publicHero__stats" role="list">
        <div className="pp-publicHero__statCell" role="listitem">
          <span className="pp-publicHero__statValue">{t('home.publicHero.stat1')}</span>
          <span className="pp-publicHero__statDesc">{t('home.publicHero.stat1Desc')}</span>
        </div>
        <div className="pp-publicHero__statCell" role="listitem">
          <span className="pp-publicHero__statValue">{t('home.publicHero.stat2')}</span>
          <span className="pp-publicHero__statDesc">{t('home.publicHero.stat2Desc')}</span>
        </div>
        <div className="pp-publicHero__statCell" role="listitem">
          <span className="pp-publicHero__statValue">{t('home.publicHero.stat3')}</span>
          <span className="pp-publicHero__statDesc">{t('home.publicHero.stat3Desc')}</span>
        </div>
      </div>
    </section>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useI18n();

  if (!user) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <PublicHero />
        </div>
        <div className="pp-col-12">
          <div className="pp-card pp-pad" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <p className="pp-subtle" style={{ margin: 0 }}>
              <Link className="pp-link" to="/login">
                {t('nav.login')}
              </Link>
              {' · '}
              <Link className="pp-link" to="/register">
                {t('nav.register')}
              </Link>
              {' · '}
              <Link className="pp-link" to="/docs">
                {t('home.tileDocs')}
              </Link>
            </p>
          </div>
        </div>
      </div>
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
