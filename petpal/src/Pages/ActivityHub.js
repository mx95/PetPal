import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useGame } from '../game/GameContext';
import PetCard from '../components/PetCard';
import HubLeaderboardPeek from '../components/HubLeaderboardPeek';
import { usePets } from '../pets/PetsContext';
import { walkStreakDays, kmTodayForPetFromSessions, latestWalkSessionForPet } from '../walk/walkStats';
import { useAutoGpsWalks } from '../walk/useAutoGpsWalks';
import LifetimeAchievements from '../components/LifetimeAchievements';
import { formatDateTime24 } from '../formatTime24';
import { playMissionCompleteSound } from '../sound/playMissionComplete';

const WEEKLY_GOAL_KM = 18;

function km(n) {
  return `${Number(n || 0).toFixed(1)} km`;
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
    return (
      <div key={m.id} className={`pp-hubMission ${done ? 'pp-hubMission--done' : ''}`}>
        <div className="pp-hubMission__body">
          <span className="pp-hubMission__label">{m.label}</span>
          <span className="pp-hubMission__xp">+{m.xp} XP</span>
          {m.description ? <span className="pp-hubMission__desc">{m.description}</span> : null}
        </div>
        {done ? null : needKm != null ? (
          <button type="button" className="pp-btn pp-btnPrimary" disabled={!walkMet} onClick={() => onCompleteMission(m.id)}>
            {walkMet ? t('activityHub.claimReward') : t('activityHub.needKm', { n: needKm })}
          </button>
        ) : (
          <button type="button" className="pp-btn pp-btnPrimary" onClick={() => onCompleteMission(m.id)}>
            {t('activityHub.gotIt')}
          </button>
        )}
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
          <div className="pp-hubSnap pp-hubSnap--today">
            <span className="pp-hubSnap__label">{t('activityHub.snapshotToday')}</span>
            <span className="pp-hubSnap__value">{km(displayTodayKm)}</span>
            <span className="pp-hubSnap__hint">{trackerDeviceId ? t('activityHub.gpsTracked') : '📍'}</span>
          </div>
          <div className="pp-hubSnap pp-hubSnap--week">
            <span className="pp-hubSnap__label">{t('activityHub.snapshotWeek')}</span>
            <span className="pp-hubSnap__value">{km(displayWeekKm)}</span>
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
              {km(displayWeekKm)} / {WEEKLY_GOAL_KM} km
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
        <div className="pp-hubMissionGrid">{DAILY_MISSIONS.map((m) => renderMission(m))}</div>
      </section>

      {/* 5. Achievements */}
      <LifetimeAchievements variant="hub" />

      {/* 7. Leaderboard peek */}
      <HubLeaderboardPeek />
    </div>
  );
}
