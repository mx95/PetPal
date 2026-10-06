import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useGame } from '../game/GameContext';
import PetCard from '../components/PetCard';
import HubLeaderboardPeek from '../components/HubLeaderboardPeek';
import { usePets } from '../pets/PetsContext';
import { walkStreakDays, kmTodayForPetFromSessions, latestWalkSessionForPet } from '../walk/walkStats';
import { estimateWalkCalories, petWalkCalorieOpts } from '../walk/walkCalories';
import { useAutoGpsWalks } from '../walk/useAutoGpsWalks';
import LifetimeAchievements from '../components/LifetimeAchievements';
import { formatDateTime24 } from '../formatTime24';
import { playMissionCompleteSound } from '../sound/playMissionComplete';

const WEEKLY_GOAL_KM = 18;

function km(n) {
  return `${Number(n || 0).toFixed(1)} km`;
}

function cal(n) {
  return `${Math.max(0, Math.round(Number(n) || 0))} cal`;
}

/**
 * Activity hub: pet hero, snapshots, goals, missions, badges, leaderboard.
 * Route: `/activity` (and profile dropdown for business accounts).
 */
export default function ActivityHub() {
  const { t, language } = useI18n();
  const { pets } = usePets();
  const {
    ownerXp,
    level,
    levelXp,
    nextMax,
    DAILY_MISSIONS,
    isDailyDone,
    completeDaily,
    walkLog,
    walkSessions,
    walkTotals,
    addWalkKm,
    dismissedGpsWalkKeys,
  } = useGame();

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

  const trackerDeviceId = pet?.trackingDeviceId?.trim?.() || '';
  const {
    gpsTodayKm,
    gpsWeekKm,
  } = useAutoGpsWalks({
    deviceId: trackerDeviceId,
    petId: pet?.id,
    walkSessions,
    dismissedGpsWalkKeys,
    addWalkKm,
  });

  const displayTodayKm = trackerDeviceId ? Math.max(todayKm, gpsTodayKm) : todayKm;
  const displayWeekKm = trackerDeviceId ? Math.max(walkTotals.week || 0, gpsWeekKm) : walkTotals.week || 0;
  const calorieOpts = useMemo(() => petWalkCalorieOpts(pet), [pet]);
  const todayCalories = useMemo(
    () => estimateWalkCalories(displayTodayKm, calorieOpts),
    [displayTodayKm, calorieOpts]
  );
  const weekCalories = useMemo(
    () => estimateWalkCalories(displayWeekKm, calorieOpts),
    [displayWeekKm, calorieOpts]
  );
  const weeklyPct = Math.min(100, Math.round((Math.max(0, displayWeekKm) / WEEKLY_GOAL_KM) * 100));
  const levelPct = Math.max(2, Math.min(100, (levelXp / Math.max(1, nextMax)) * 100));

  const statusKey =
    displayTodayKm > 0
      ? 'active'
      : streakDays > 0 && latestWalkPet?.createdAt
        ? 'lastSeen'
        : pet?.trackingDeviceId?.trim?.()
          ? 'trackingHint'
          : 'noWalkToday';
  const statusValue =
    statusKey === 'active'
      ? `${(Math.round(displayTodayKm * 10) / 10).toFixed(1)} km`
      : statusKey === 'lastSeen' && latestWalkPet?.createdAt
        ? formatDateTime24(new Date(latestWalkPet.createdAt), language)
        : '';

  const onCompleteMission = useCallback(
    (missionId) => {
      if (completeDaily(missionId)) playMissionCompleteSound();
    },
    [completeDaily]
  );

  const renderMission = (m) => {
    const done = isDailyDone(m.id);
    const needKm = m.minWalkKmToday;
    const dayKm = displayTodayKm;
    const walkMet = needKm == null || dayKm >= needKm;
    const label = t(`activityHub.missions.${m.id}.label`);
    return (
      <div key={m.id} className={`pp-hubMission ${done ? 'pp-hubMission--done' : ''}`}>
        <div className="pp-hubMission__body">
          <span className="pp-hubMission__icon" aria-hidden>
            {m.icon}
          </span>
          <span className="pp-hubMission__label">{label}</span>
          <span className="pp-hubMission__xp">+{m.xp} XP</span>
        </div>
        <div className="pp-hubMission__action">
          {done ? (
            <span className="pp-hubMission__doneTag">{t('activityHub.doneTag')}</span>
          ) : needKm != null ? (
            <button type="button" className="pp-btn pp-btnPrimary" disabled={!walkMet} onClick={() => onCompleteMission(m.id)}>
              {walkMet ? t('activityHub.claimReward') : t('activityHub.needKm', { n: needKm })}
            </button>
          ) : (
            <button type="button" className="pp-btn pp-btnPrimary" onClick={() => onCompleteMission(m.id)}>
              {t('activityHub.gotIt')}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pp-feed pp-activityHub">
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
                    />
                  </div>
                );
              })}
            </div>
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
          <div className="pp-hubSnap pp-hubSnap--distance">
            <div className="pp-hubSnap__head">
              <span className="pp-hubSnap__icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z" />
                </svg>
              </span>
              <span className="pp-hubSnap__label">{t('activityHub.snapshotDistance')}</span>
            </div>
            <span className="pp-hubSnap__value">{km(displayTodayKm)}</span>
            <span className="pp-hubSnap__hint">
              {trackerDeviceId ? t('activityHub.gpsTracked') : t('activityHub.walkedToday')}
            </span>
            <span className="pp-hubSnap__deco pp-hubSnap__deco--path" aria-hidden />
          </div>
          <div className="pp-hubSnap pp-hubSnap--calories">
            <div className="pp-hubSnap__head">
              <span className="pp-hubSnap__icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 23c-3.9 0-7-2.9-7-7.2 0-3.1 1.9-5.6 3.5-7.3.5-.5 1.3-.1 1.3.6 0 1.1.3 2.1.8 2.8.4-3.5 2.5-6.4 4.9-8.5.5-.4 1.2.1 1.1.7-.3 2.2.1 3.9 1.1 5.4 1.1-1 1.8-2.4 2-3.8.1-.6.9-.8 1.2-.3C20.2 7.6 21 10 21 12.5 21 18.4 17.1 23 12 23z" />
                </svg>
              </span>
              <span className="pp-hubSnap__label">{t('activityHub.snapshotCalories')}</span>
            </div>
            <span className="pp-hubSnap__value">{cal(todayCalories)}</span>
            <span className="pp-hubSnap__hint">{t('activityHub.burnedToday')}</span>
            <span className="pp-hubSnap__deco pp-hubSnap__deco--flame" aria-hidden />
          </div>
          <div className="pp-hubSnap pp-hubSnap--streak">
            <div className="pp-hubSnap__head">
              <span className="pp-hubSnap__icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.7l5.4-.8L12 2z" />
                </svg>
              </span>
              <span className="pp-hubSnap__label">{t('activityHub.snapshotStreak')}</span>
            </div>
            <span className="pp-hubSnap__value">
              {streakDays} {t('activityHub.daysUnitShort')}
            </span>
            <span className="pp-hubSnap__deco pp-hubSnap__deco--trophy" aria-hidden />
          </div>
          <div className="pp-hubSnap pp-hubSnap--level">
            <div className="pp-hubSnap__head">
              <span className="pp-hubSnap__icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M4 18h3v-6H4v6zm6.5 0h3V6h-3v12zM17 18h3v-9h-3v9z" />
                </svg>
              </span>
              <span className="pp-hubSnap__label">{t('activityHub.snapshotLevel')}</span>
            </div>
            <span className="pp-hubSnap__value">Lv.{level}</span>
            <span className="pp-hubSnap__hint">{ownerXp} XP</span>
            <span className="pp-hubSnap__deco pp-hubSnap__deco--paw" aria-hidden />
          </div>
        </div>

        <article className="pp-hubWeekCard" aria-label={t('activityHub.weekCardAria')}>
          <div className="pp-hubWeekCard__head">
            <span className="pp-hubWeekCard__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M8.5 14.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm7-6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM8.5 20c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3zm7-6c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z" />
              </svg>
            </span>
            <h3 className="pp-hubWeekCard__title">{t('activityHub.weekCardTitle')}</h3>
            <Link className="pp-hubWeekCard__more" to="/tracking" aria-label={t('activityHub.weekCardOpen')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                <path d="M9.3 6.7L14.6 12l-5.3 5.3 1.4 1.4L17.4 12 10.7 5.3z" />
              </svg>
            </Link>
          </div>
          <p className="pp-hubWeekCard__km">{km(displayWeekKm)}</p>
          <div className="pp-hubWeekCard__stats">
            <div className="pp-hubWeekCard__stat">
              <span className="pp-hubWeekCard__statIcon pp-hubWeekCard__statIcon--flame" aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 23c-3.9 0-7-2.9-7-7.2 0-3.1 1.9-5.6 3.5-7.3.5-.5 1.3-.1 1.3.6 0 1.1.3 2.1.8 2.8.4-3.5 2.5-6.4 4.9-8.5.5-.4 1.2.1 1.1.7-.3 2.2.1 3.9 1.1 5.4 1.1-1 1.8-2.4 2-3.8.1-.6.9-.8 1.2-.3C20.2 7.6 21 10 21 12.5 21 18.4 17.1 23 12 23z" />
                </svg>
              </span>
              <div>
                <strong>{cal(weekCalories)}</strong>
                <span>{t('activityHub.weekCaloriesLabel')}</span>
              </div>
            </div>
            <div className="pp-hubWeekCard__stat">
              <span className="pp-hubWeekCard__statIcon pp-hubWeekCard__statIcon--bars" aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M4 18h3v-6H4v6zm6.5 0h3V6h-3v12zM17 18h3v-9h-3v9z" />
                </svg>
              </span>
              <div>
                <strong>{weeklyPct}%</strong>
                <span>{t('activityHub.weekGoalOf', { n: WEEKLY_GOAL_KM })}</span>
              </div>
            </div>
          </div>
          <div className="pp-hubWeekCard__bar" aria-hidden>
            <div className="pp-hubWeekCard__barFill" style={{ width: `${weeklyPct}%` }} />
          </div>
        </article>
      </section>

      {/* 3. Progress (XP — weekly goal lives on the snapshot week card) */}
      <section className="pp-card pp-pad pp-hubProgressCard">
        <h2 className="pp-hubProgressCard__title">{t('activityHub.progressTitle')}</h2>
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
        <div className="pp-hubMissionGrid">{DAILY_MISSIONS.map((m) => renderMission(m))}</div>
      </section>

      {/* 5. Achievements */}
      <LifetimeAchievements variant="hub" />

      {/* 7. Leaderboard peek */}
      <HubLeaderboardPeek />
    </div>
  );
}
