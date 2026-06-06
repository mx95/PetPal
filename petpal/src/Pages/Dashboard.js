import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useGame } from '../game/GameContext';
import PetAvatar from '../components/PetAvatar';
import PetCard from '../components/PetCard';
import HubLeaderboardPeek from '../components/HubLeaderboardPeek';
import { usePets } from '../pets/PetsContext';
import { MAX_PHOTOS_PER_WALK_SESSION } from '../walk/walkPhotos';
import { walkStreakDays, kmTodayForPetFromSessions, latestWalkSessionForPet } from '../walk/walkStats';
import { useSuggestedWalks } from '../walk/useSuggestedWalks';
import { formatTime24 } from '../formatTime24';
import LifetimeAchievements from '../components/LifetimeAchievements';
import { formatDateTime24 } from '../formatTime24';
import { MVP_NAV } from '../config/mvpNav';

const WEEKLY_GOAL_KM = 18;
const DAILY_MISSIONS_HUB = 3;
const PACK_HUB_MAX = 4;
const PET_ACH_HUB = 2;

function km(n) {
  return `${Number(n || 0).toFixed(1)} km`;
}

function ProgressMicro({ value01 }) {
  const pct = Math.round(Math.min(1, Math.max(0, value01)) * 100);
  return (
    <div className="pp-microBar" aria-label={`${pct}%`}>
      <div className="pp-microBar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Unified Activity Hub: walks, snapshots, goals, lifetime badges, leaderboard peek.
 * Route stays `/dashboard` for deep links (#pp-walk-input-anchor).
 */
export default function Dashboard() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { pets, getCategory } = usePets();
  const {
    ownerXp,
    level,
    levelXp,
    nextMax,
    DAILY_MISSIONS,
    isDailyDone,
    completeDaily,
    petProgressPercent,
    trackingAchievementDefs,
    walkAchievementDefs,
    walkLog,
    walkSessions,
    walkTotals,
    addWalkKm,
    dismissSuggestedWalk,
    dismissedGpsWalkKeys,
    latestWalk,
    addPhotosToLatestWalk,
    removePhotoFromLatestWalk,
  } = useGame();

  const walkFieldId = useId();
  const walkFilesId = useId();
  const walkFilesRef = useRef(null);
  const morePhotosId = useId();
  const [walkInput, setWalkInput] = useState('');
  const [walkLogBusy, setWalkLogBusy] = useState(false);
  const [walkPhotoMsg, setWalkPhotoMsg] = useState('');
  const [suggestionBusyKey, setSuggestionBusyKey] = useState('');
  const [petIdx, setPetIdx] = useState(0);
  const carouselRef = useRef(null);
  const scrollSyncRaf = useRef(null);

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

  const streakDays = walkStreakDays(walkLog);
  const pet = pets.length ? pets[petIdx % pets.length] : null;
  const petsCount = pets.length;
  const latestWalkPet = useMemo(
    () => (pet?.id ? latestWalkSessionForPet(walkSessions, pet.id, petsCount) : null),
    [walkSessions, pet?.id, petsCount]
  );
  const todayKm = useMemo(
    () =>
      pet?.id
        ? kmTodayForPetFromSessions(walkSessions, pet.id, petsCount, walkTotals.day || 0)
        : walkTotals.day || 0,
    [walkSessions, pet?.id, petsCount, walkTotals.day]
  );

  const statusKey =
    todayKm > 0
      ? 'active'
      : streakDays > 0 && latestWalkPet?.createdAt
        ? 'lastSeen'
        : pet?.trackingDeviceId?.trim?.()
          ? 'trackingHint'
          : 'noWalkToday';
  const statusValue =
    statusKey === 'active'
      ? `${(Math.round(todayKm * 10) / 10).toFixed(1)} km`
      : statusKey === 'lastSeen' && latestWalkPet?.createdAt
        ? formatDateTime24(new Date(latestWalkPet.createdAt), language)
        : '';

  const weeklyPct = Math.min(100, Math.round((Math.max(0, walkTotals.week) / WEEKLY_GOAL_KM) * 100));
  const levelPct = Math.max(2, Math.min(100, (levelXp / Math.max(1, nextMax)) * 100));

  const trackerDeviceId = pet?.trackingDeviceId?.trim?.() || '';
  const { suggestions: suggestedWalks, loading: suggestionsLoading, error: suggestionsError, refresh: refreshSuggestions } =
    useSuggestedWalks({
      deviceId: trackerDeviceId,
      petId: pet?.id,
      walkSessions,
      dismissedGpsWalkKeys,
    });

  const onAcceptSuggestion = async (s) => {
    if (!s?.gpsKey || suggestionBusyKey) return;
    setWalkPhotoMsg('');
    setSuggestionBusyKey(s.gpsKey);
    try {
      const ok = await addWalkKm(s.distanceKm, null, pet?.id, {
        source: 'gps',
        gpsKey: s.gpsKey,
        startedAt: s.startAt,
        endedAt: s.endAt,
      });
      if (ok) setWalkPhotoMsg(t('activityHub.suggestedWalkLogged', { km: s.distanceKm.toFixed(1) }));
    } finally {
      setSuggestionBusyKey('');
    }
  };

  const onDismissSuggestion = (s) => {
    if (!s?.gpsKey) return;
    dismissSuggestedWalk(s.gpsKey);
  };

  const onLogWalk = async (e) => {
    e.preventDefault();
    setWalkPhotoMsg('');
    const n = parseFloat(String(walkInput).replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) {
      setWalkPhotoMsg(t('dashboard.walkLogMsg1'));
      return;
    }
    setWalkLogBusy(true);
    try {
      const files = walkFilesRef.current?.files;
      const ok = await addWalkKm(n, files, pet?.id);
      if (ok) {
        setWalkInput('');
        if (walkFilesRef.current) walkFilesRef.current.value = '';
        setWalkPhotoMsg(files?.length ? t('dashboard.walkLogOkPhotos') : t('dashboard.walkLogOk'));
      }
    } finally {
      setWalkLogBusy(false);
    }
  };

  const onAddMorePhotos = async (e) => {
    const { files } = e.target;
    setWalkPhotoMsg('');
    if (!files?.length) return;
    setWalkLogBusy(true);
    try {
      const r = await addPhotosToLatestWalk(files);
      if (r.ok) setWalkPhotoMsg(r.added ? t('dashboard.photoAdded', { n: r.added }) : '');
      else if (r.reason === 'max_photos') setWalkPhotoMsg(t('dashboard.photoMax', { max: MAX_PHOTOS_PER_WALK_SESSION }));
      else if (r.reason === 'no_session') setWalkPhotoMsg(t('dashboard.photoLogFirst'));
      else setWalkPhotoMsg(t('dashboard.photoError'));
    } finally {
      setWalkLogBusy(false);
      e.target.value = '';
    }
  };

  const greetingName =
    user?.displayName?.trim() || (user?.email ? user.email.split('@')[0] : '') || '';

  const dailyPrimary = useMemo(() => DAILY_MISSIONS.slice(0, DAILY_MISSIONS_HUB), [DAILY_MISSIONS]);
  const dailyExtra = useMemo(() => DAILY_MISSIONS.slice(DAILY_MISSIONS_HUB), [DAILY_MISSIONS]);

  const renderMission = (m) => {
    const done = isDailyDone(m.id);
    const needKm = m.minWalkKmToday;
    const dayKm = walkTotals.day;
    const walkMet = needKm == null || dayKm >= needKm;
    return (
      <div key={m.id} className={`pp-hubMission ${done ? 'pp-hubMission--done' : ''}`}>
        <div className="pp-hubMission__body">
          <span className="pp-hubMission__label">{m.label}</span>
          <span className="pp-hubMission__xp">+{m.xp} XP</span>
          {m.description ? <span className="pp-hubMission__desc">{m.description}</span> : null}
          {needKm != null && !done ? (
            <span className="pp-hubMission__track">
              {t('dashboard.todaySlash', { cur: dayKm.toFixed(1), need: needKm })}
            </span>
          ) : null}
        </div>
        {done ? (
          <span className="pp-hubMission__tag">{t('activityHub.doneTag')}</span>
        ) : needKm != null ? (
          <button type="button" className="pp-btn pp-btnPrimary" disabled={!walkMet} onClick={() => completeDaily(m.id)}>
            {walkMet ? t('activityHub.claimReward') : t('activityHub.needKm', { n: needKm })}
          </button>
        ) : (
          <button type="button" className="pp-btn pp-btnPrimary" onClick={() => completeDaily(m.id)}>
            {t('activityHub.gotIt')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="pp-feed pp-activityHub">
      <header className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <span className="pp-publicHero__eyebrow" style={{ display: 'inline-block', width: 'fit-content' }}>
            {t('activityHub.badge')}
          </span>
          <h1 className="pp-pageHeader__title">{t('activityHub.title')}</h1>
          <p className="pp-pageHeader__sub">{t('activityHub.sub')}</p>
          {greetingName ? (
            <span className="pp-activityHub__greet">{t('home.dashboardHero.hello', { name: greetingName })}</span>
          ) : null}
        </div>
        <Link className="pp-pageHeader__back" to="/profile">
          {t('activityHub.profileCta')}
        </Link>
      </header>

      {/* 1. Hero */}
      <section aria-label={t('home.feed.petCardAria')} className="pp-activityHub__block">
        {pets.length ? (
          <>
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
                        const anchor = document.getElementById('pp-walk-input-anchor');
                        anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="pp-hubHeroActions">
              <a href="#pp-walk-input-anchor" className="pp-btn pp-btnPrimary">
                {t('home.dashboardHero.logWalkCta')}
              </a>
              <Link className="pp-btn pp-btn--ghost" to="/tracking">
                {t('home.feed.quickTrack')}
              </Link>
              <Link className="pp-btn pp-btn--ghost" to="/pets">
                {t('activityHub.viewHistory')}
              </Link>
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
          </>
        ) : (
          <div className="pp-card pp-pad pp-activityHub__emptyPet">
            <span aria-hidden style={{ fontSize: 40 }}>
              🐕
            </span>
            <h2 className="pp-sectionTitle">{t('activityHub.noPetHeroTitle')}</h2>
            <p className="pp-subtle">{t('activityHub.noPetHeroSub')}</p>
            <Link className="pp-btn pp-btnPrimary" to="/pets#add-pet">
              {t('home.feed.noPetCta')}
            </Link>
          </div>
        )}
      </section>

      {/* 2. Snapshot */}
      <section className="pp-activityHub__block" aria-label={t('activityHub.snapshotAria')}>
        <h2 className="pp-feed__sectionTitle">{t('activityHub.snapshotTitle')}</h2>
        <div className="pp-hubSnapGrid">
          <div className="pp-hubSnap pp-hubSnap--today">
            <span className="pp-hubSnap__label">{t('activityHub.snapshotToday')}</span>
            <span className="pp-hubSnap__value">{km(walkTotals.day)}</span>
            <span className="pp-hubSnap__hint">📍</span>
          </div>
          <div className="pp-hubSnap pp-hubSnap--week">
            <span className="pp-hubSnap__label">{t('activityHub.snapshotWeek')}</span>
            <span className="pp-hubSnap__value">{km(walkTotals.week)}</span>
            <span className="pp-hubSnap__hint">{t('activityHub.weekGoalTiny', { n: WEEKLY_GOAL_KM })}</span>
          </div>
          <div className="pp-hubSnap pp-hubSnap--streak">
            <span className="pp-hubSnap__label">{t('activityHub.snapshotStreak')}</span>
            <span className="pp-hubSnap__value">{streakDays}</span>
            <span className="pp-hubSnap__hint">{t('activityHub.daysUnit')}</span>
          </div>
          <div className="pp-hubSnap pp-hubSnap--level">
            <span className="pp-hubSnap__label">{t('activityHub.snapshotLevel')}</span>
            <span className="pp-hubSnap__value">Lv.{level}</span>
            <span className="pp-hubSnap__hint">{ownerXp} XP</span>
          </div>
        </div>
      </section>

      {/* 3. Progress */}
      <section className="pp-card pp-pad pp-hubProgressCard">
        <h2 className="pp-hubProgressCard__title">{t('activityHub.progressTitle')}</h2>
        <div className="pp-hubGoal">
          <div className="pp-hubGoal__row">
            <span>{t('activityHub.weeklyGoalLabel')}</span>
            <span className="pp-hubGoal__nums">
              {km(walkTotals.week)} / {WEEKLY_GOAL_KM} km
            </span>
          </div>
          <div className="pp-levelBar pp-hubGoal__bar" aria-hidden>
            <div className="pp-levelBar__fill" style={{ width: `${weeklyPct}%` }} />
          </div>
          <p className="pp-hubGoal__motivate">{t('activityHub.weeklyGoalLine', { pct: weeklyPct })}</p>
        </div>
        <details className="pp-hubXpFold">
          <summary className="pp-hubXpFold__sum">{t('activityHub.xpDetailsToggle')}</summary>
          <div className="pp-hubGoal pp-hubGoal--xp">
            <div className="pp-hubGoal__row">
              <span>
                {t('lifetime.title')} — {t('activityHub.levelXpLabel')}
              </span>
              <span className="pp-hubGoal__nums">{ownerXp} XP</span>
            </div>
            <div className="pp-levelBar pp-hubGoal__bar" aria-hidden>
              <div className="pp-levelBar__fill pp-levelBar__fill--purple" style={{ width: `${levelPct}%` }} />
            </div>
            <p className="pp-hubGoal__motivate">{t('activityHub.xpToNext', { current: levelXp, max: nextMax })}</p>
          </div>
        </details>
      </section>

      {/* 4. Daily missions */}
      <section className="pp-activityHub__block">
        <h2 className="pp-feed__sectionTitle">{t('activityHub.dailyTitle')}</h2>
        <p className="pp-subtle" style={{ marginBottom: 12 }}>
          {t('activityHub.dailySub')}
        </p>
        <div className="pp-hubMissionGrid">{dailyPrimary.map((m) => renderMission(m))}</div>
        {dailyExtra.length ? (
          <details className="pp-hubMissionFold">
            <summary className="pp-hubMissionFold__sum">{t('activityHub.dailyShowMore', { n: DAILY_MISSIONS.length })}</summary>
            <div className="pp-hubMissionGrid pp-hubMissionGrid--extra">{dailyExtra.map((m) => renderMission(m))}</div>
          </details>
        ) : null}
      </section>

      {/* 5. Walk log */}
      <section className="pp-card pp-pad pp-hubWalkCard" id="pp-walk-input-anchor">
        <h2 className="pp-sectionTitle">{t('activityHub.walkTitle')}</h2>
        <p className="pp-subtle" style={{ marginBottom: 12 }}>
          {t('activityHub.walkSub')}
        </p>

        {trackerDeviceId ? (
          <div className="pp-suggestedWalks" style={{ marginBottom: 16 }}>
            <div className="pp-suggestedWalks__head">
              <h3 className="pp-suggestedWalks__title">{t('activityHub.suggestedWalksTitle')}</h3>
              <button
                type="button"
                className="pp-link pp-suggestedWalks__refresh"
                disabled={suggestionsLoading}
                onClick={() => void refreshSuggestions()}
              >
                {suggestionsLoading ? t('activityHub.suggestedWalksLoading') : t('activityHub.suggestedWalksRefresh')}
              </button>
            </div>
            <p className="pp-subtle pp-suggestedWalks__sub">{t('activityHub.suggestedWalksSub')}</p>
            {suggestionsError ? (
              <p className="pp-subtle pp-suggestedWalks__err">{suggestionsError}</p>
            ) : null}
            {!suggestionsLoading && suggestedWalks.length === 0 && !suggestionsError ? (
              <p className="pp-subtle pp-suggestedWalks__empty">{t('activityHub.suggestedWalksEmpty')}</p>
            ) : null}
            {suggestedWalks.length > 0 ? (
              <ul className="pp-suggestedWalks__list">
                {suggestedWalks.map((s) => {
                  const timeLabel = `${formatTime24(new Date(s.startAt), language)} – ${formatTime24(new Date(s.endAt), language)}`;
                  const busy = suggestionBusyKey === s.gpsKey;
                  return (
                    <li key={s.gpsKey} className="pp-suggestedWalk">
                      <div className="pp-suggestedWalk__body">
                        <span className="pp-suggestedWalk__km">{s.distanceKm.toFixed(1)} km</span>
                        <span className="pp-suggestedWalk__meta">
                          {timeLabel}
                          {' · '}
                          {t('activityHub.suggestedWalkDuration', { min: s.durationMin })}
                        </span>
                      </div>
                      <div className="pp-suggestedWalk__actions">
                        <button
                          type="button"
                          className="pp-btn pp-btnPrimary"
                          disabled={busy || walkLogBusy}
                          onClick={() => void onAcceptSuggestion(s)}
                        >
                          {busy ? t('activityHub.saving') : t('activityHub.suggestedWalkAdd')}
                        </button>
                        <button
                          type="button"
                          className="pp-btn pp-btn--ghost"
                          disabled={busy}
                          onClick={() => onDismissSuggestion(s)}
                        >
                          {t('activityHub.suggestedWalkDismiss')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="pp-subtle pp-suggestedWalks__hint" style={{ marginBottom: 14 }}>
            {t('activityHub.suggestedWalksNoTracker')}
          </p>
        )}

        <details className="pp-hubManualWalk">
          <summary className="pp-hubManualWalk__sum">{t('activityHub.manualWalkToggle')}</summary>
        <form onSubmit={onLogWalk} className="pp-form" style={{ marginBottom: 14, marginTop: 12 }}>
          <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label htmlFor={walkFieldId} className="pp-label">
                {t('activityHub.addTodayKm')}
              </label>
              <input id={walkFieldId} className="pp-input" type="text" inputMode="decimal" placeholder="0.0" value={walkInput} onChange={(e) => setWalkInput(e.target.value)} style={{ maxWidth: 120 }} />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label htmlFor={walkFilesId} className="pp-label">
                {t('activityHub.photosOptional')}
              </label>
              <input id={walkFilesId} ref={walkFilesRef} className="pp-input" type="file" accept="image/*" multiple style={{ fontSize: 14 }} />
              <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                {t('activityHub.photosHint')}
              </p>
            </div>
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={walkLogBusy}>
              {walkLogBusy ? t('activityHub.saving') : t('activityHub.logWalk')}
            </button>
          </div>
          {walkPhotoMsg ? (
            <p className="pp-subtle" style={{ marginTop: 10, fontSize: 13 }}>
              {walkPhotoMsg}
            </p>
          ) : null}
        </form>
        </details>

        {latestWalk ? (
          <div className="pp-hubLatestWalk">
            <h3 className="pp-hubLatestWalk__title">{t('activityHub.latestWalk')}</h3>
            <p className="pp-subtle pp-hubLatestWalk__meta">
              <strong>{km(latestWalk.km)}</strong> ·{' '}
              {formatDateTime24(new Date(latestWalk.createdAt), language)}
            </p>
            {latestWalk.photos?.length ? (
              <div className="pp-walkPhotoGrid">
                {latestWalk.photos.map((src, i) => (
                  <div key={`${latestWalk.id}-p${i}`} className="pp-walkPhotoTile">
                    <img src={src} alt="" className="pp-walkPhotoTile__img" />
                    <button type="button" className="pp-walkPhotoTile__remove" onClick={() => removePhotoFromLatestWalk(i)} aria-label={t('activityHub.removePhoto')}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pp-subtle" style={{ fontSize: 14 }}>
                {t('activityHub.noPhotosYet')}
              </p>
            )}
            <label className="pp-btn pp-btn--ghost" htmlFor={morePhotosId} style={{ marginTop: 8, cursor: 'pointer', display: 'inline-block' }}>
              {t('activityHub.morePhotos')}
            </label>
            <input id={morePhotosId} type="file" accept="image/*" multiple className="pp-visuallyHidden" onChange={onAddMorePhotos} disabled={walkLogBusy} />
          </div>
        ) : null}
      </section>

      {/* Pack strip */}
      <section className="pp-card pp-pad pp-hubPack">
        <div className="pp-hubPack__head">
          <h2 className="pp-sectionTitle" style={{ margin: 0 }}>{t('activityHub.packTitle')}</h2>
          <Link className="pp-link" to="/pets" style={{ padding: '4px 0' }}>
            {t('activityHub.packLinkPets')}
          </Link>
        </div>
        {pets.length === 0 ? (
          <p className="pp-subtle">
            <Link className="pp-link" to="/pets#add-pet">{t('dashboard.addFirst')}</Link>{' '}
            {t('dashboard.toUnlock')}
          </p>
        ) : (
          <ul className="pp-hubPackList">
            {pets.slice(0, PACK_HUB_MAX).map((p) => (
              <li key={p.id} className="pp-hubPackList__item">
                <PetAvatar pet={p} size={40} />
                <div className="pp-hubPackList__meta">
                  <span className="pp-hubPackList__name">{p.name}</span>
                  <span className="pp-hubPackList__sub">{getCategory(p).label}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pets.length > PACK_HUB_MAX ? (
          <p className="pp-subtle pp-activityHub__packMore">
            <Link className="pp-link" to="/pets" style={{ padding: 0 }}>
              {t('activityHub.packMorePets', { n: pets.length - PACK_HUB_MAX })}
            </Link>
          </p>
        ) : null}
      </section>

      {/* Per-pet tracks (accordion) */}
      {pets.length > 0 ? (
        <section className="pp-activityHub__block">
          <details className="pp-hubAccordion">
            <summary className="pp-hubAccordion__sum">{t('activityHub.petTracksTitle')}</summary>
            <p className="pp-subtle" style={{ marginBottom: 12 }}>
              {t('activityHub.petTracksSub')}
            </p>
            <p className="pp-subtle pp-activityHub__petGoalsHint">{t('activityHub.petGoalsHubHint')}</p>
            {pets.map((p) => (
              <details key={p.id} className="pp-hubAccordion pp-hubAccordion--nested">
                <summary className="pp-hubAccordion__sum">
                  <PetAvatar pet={p} size={28} /> {p.name}
                </summary>
                <div className="pp-petAchGrid pp-petAchGrid--hub">
                  <div className="pp-achSection pp-achSection--track">
                    <div className="pp-achSection__label">📡 GPS</div>
                    {trackingAchievementDefs.slice(0, PET_ACH_HUB).map((a) => (
                      <div key={a.key} className="pp-achLine pp-achLine--compact">
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</div>
                        <ProgressMicro value01={petProgressPercent(p.id, 'track', a.key)} />
                      </div>
                    ))}
                  </div>
                  <div className="pp-achSection pp-achSection--walk">
                    <div className="pp-achSection__label">🚶 Walks</div>
                    {walkAchievementDefs.slice(0, PET_ACH_HUB).map((a) => (
                      <div key={a.key} className="pp-achLine pp-achLine--compact">
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</div>
                        <ProgressMicro value01={petProgressPercent(p.id, 'walk', a.key)} />
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </details>
        </section>
      ) : null}

      {/* 6. Achievements */}
      <LifetimeAchievements variant="hub" />

      {/* 7. Leaderboard peek */}
      <HubLeaderboardPeek />

      {/* Explore */}
      <section className="pp-activityHub__block">
        <h2 className="pp-feed__sectionTitle">{t('dashboard.exploreTitle')}</h2>
        <div className="pp-actionGrid">
          <Link className="pp-actionCard pp-actionCard--pets" to="/nearby">
            <span className="pp-actionCard__icon" aria-hidden>📍</span>
            <div className="pp-actionCard__body">
              <span className="pp-actionCard__title">{t('dashboard.exploreNearbyTitle')}</span>
              <span className="pp-actionCard__desc">{t('dashboard.exploreNearbyDesc')}</span>
            </div>
            <span className="pp-actionCard__arrow" aria-hidden>→</span>
          </Link>
          {MVP_NAV.showCommunity ? (
            <Link className="pp-actionCard pp-actionCard--breeding" to="/community">
              <span className="pp-actionCard__icon" aria-hidden>🐾</span>
              <div className="pp-actionCard__body">
                <span className="pp-actionCard__title">{t('dashboard.exploreCommunityTitle')}</span>
                <span className="pp-actionCard__desc">{t('dashboard.exploreCommunityDesc')}</span>
              </div>
              <span className="pp-actionCard__arrow" aria-hidden>→</span>
            </Link>
          ) : null}
          {MVP_NAV.showPremium ? (
            <Link className="pp-actionCard pp-actionCard--lost" to="/premium/lost">
              <span className="pp-actionCard__icon" aria-hidden>🚨</span>
              <div className="pp-actionCard__body">
                <span className="pp-actionCard__title">{t('dashboard.exploreLostTitle')}</span>
                <span className="pp-actionCard__desc">{t('dashboard.exploreLostDesc')}</span>
              </div>
              <span className="pp-actionCard__arrow" aria-hidden>→</span>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
