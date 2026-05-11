import React, { useMemo } from 'react';
import { useGame } from '../game/GameContext';
import { useI18n } from '../i18n/I18nContext';

const KIND_DESC_KEY = {
  distance: 'lifetime.descKm',
  walks: 'lifetime.descWalks',
  streak: 'lifetime.descStreak',
  level: 'lifetime.descLevel',
  pets: 'lifetime.descPets',
  photos: 'lifetime.descPhotos',
  peak: 'lifetime.descPeak',
  daily: 'lifetime.descDaily',
};

const KIND_ICON = {
  distance: '👟',
  walks: '🚶',
  streak: '🔥',
  level: '⭐',
  pets: '🐾',
  photos: '📸',
  peak: '🏔️',
  daily: '✅',
};

/**
 * Format the value/target for an achievement based on its kind.
 * Distance/peak use km, others are integer counts.
 */
function formatPair(kind, value, target) {
  if (kind === 'distance' || kind === 'peak') {
    const v = (Math.round(Number(value) * 10) / 10).toFixed(1);
    return `${v} / ${target} km`;
  }
  return `${Math.floor(Number(value) || 0)} / ${target}`;
}

function describe(t, a) {
  const key = KIND_DESC_KEY[a.kind] || 'lifetime.descKm';
  return t(key, { n: a.target, s: a.target === 1 ? '' : 's' });
}

export default function LifetimeAchievements({ variant = 'full' }) {
  const { t } = useI18n();
  const hub = variant === 'hub';
  const { lifetimeAchievements, achievementXp, achievementCount, lifetimeAchievementDefs } = useGame();

  const totalAll = Array.isArray(lifetimeAchievementDefs) ? lifetimeAchievementDefs.length : 0;

  // Dashboard/hub should feel lightweight: show only a starter set.
  const BASIC_KINDS = ['distance', 'walks', 'streak', 'level', 'pets'];
  const ITEMS_PER_KIND = 2;

  const groups = useMemo(() => {
    const order = hub ? BASIC_KINDS : ['distance', 'walks', 'streak', 'level', 'pets', 'photos', 'peak', 'daily'];
    const buckets = new Map();
    for (const a of lifetimeAchievements || []) {
      if (hub && !BASIC_KINDS.includes(a.kind)) continue;
      if (!buckets.has(a.kind)) buckets.set(a.kind, []);
      buckets.get(a.kind).push(a);
    }
    return order
      .filter((k) => buckets.has(k))
      .map((k) => {
        const items = buckets
          .get(k)
          .slice()
          .sort((a, b) => (a.target || 0) - (b.target || 0));
        return { kind: k, items: hub ? items.slice(0, ITEMS_PER_KIND) : items };
      });
  }, [lifetimeAchievements, hub]);

  const totals = useMemo(() => {
    if (!hub) return { total: totalAll, unlocked: achievementCount };
    const flat = groups.flatMap((g) => g.items);
    return { total: flat.length, unlocked: flat.filter((a) => a.earned).length };
  }, [achievementCount, groups, hub, totalAll]);

  const closestNext = useMemo(() => {
    const remaining = (lifetimeAchievements || []).filter((a) => !a.earned);
    if (remaining.length === 0) return null;
    return [...remaining].sort((a, b) => b.progress - a.progress)[0];
  }, [lifetimeAchievements]);

  return (
    <section className={`pp-card pp-pad pp-lifetime${hub ? ' pp-lifetime--hub' : ''}`} aria-labelledby="pp-lifetimeTitle">
      <div className={`pp-lifetime__head${hub ? ' pp-lifetime__head--hub' : ''}`}>
        <div>
          <span className="pp-lifetime__eyebrow">{t('lifetime.badge')}</span>
          <h2 id="pp-lifetimeTitle" className="pp-sectionTitle" style={{ marginTop: 6 }}>
            {t('lifetime.title')}
          </h2>
          <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 640 }}>
            {hub ? t('activityHub.badgesLead') : t('lifetime.subtitle')}
          </p>
        </div>
        <div className="pp-lifetime__summary" role="status" aria-live="polite">
          <div className="pp-lifetime__summaryStat">
            <span className="pp-lifetime__summaryLabel">{t('lifetime.summaryUnlocked', { n: totals.unlocked, total: totals.total })}</span>
            <div className="pp-lifetime__summaryBar" aria-hidden>
              <div
                className="pp-lifetime__summaryBarFill"
                style={{ width: `${totals.total ? Math.round((totals.unlocked / totals.total) * 100) : 0}%` }}
              />
            </div>
          </div>
          <div className="pp-lifetime__summaryXp">{t('lifetime.summaryXp', { xp: achievementXp })}</div>
          {closestNext ? (
            <div className="pp-lifetime__summaryHint">
              {t('lifetime.summaryNextHint', { label: t(`lifetime.ach.${closestNext.id}.label`) })}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`pp-lifetime__groups${hub ? ' pp-lifetime__groups--hub' : ''}`}>
        {groups.map((g) => (
          <div key={g.kind} className={`pp-lifetime__group pp-lifetime__group--${g.kind}`}>
            <div className="pp-lifetime__groupHead">
              <span className="pp-lifetime__groupIcon" aria-hidden>{KIND_ICON[g.kind] || '✨'}</span>
              <h3 className="pp-lifetime__groupTitle">{t(`lifetime.cat.${g.kind}`)}</h3>
            </div>
            <ul className={`pp-lifetime__list${hub ? ' pp-lifetime__list--hub' : ''}`}>
              {g.items.map((a) => {
                const pct = Math.round((a.progress || 0) * 100);
                const label = t(`lifetime.ach.${a.id}.label`);
                return (
                  <li
                    key={a.id}
                    className={`pp-achTile pp-achTile--${a.tier} ${a.earned ? 'pp-achTile--earned' : ''}`}
                  >
                    <div className="pp-achTile__row">
                      <div className="pp-achTile__label">{label}</div>
                      <div className="pp-achTile__xp">+{a.xp} XP</div>
                    </div>
                    <div className="pp-achTile__desc">{describe(t, a)}</div>
                    <div
                      className="pp-achTile__bar"
                      role="progressbar"
                      aria-label={t('lifetime.progressAria', { label })}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                    >
                      <div className="pp-achTile__barFill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="pp-achTile__row pp-achTile__row--meta">
                      <span className="pp-achTile__progress">
                        {formatPair(a.kind, a.value, a.target)}
                      </span>
                      <span className="pp-achTile__tier">{t(`lifetime.tier.${a.tier}`)}</span>
                    </div>
                    {a.earned ? (
                      <span className="pp-achTile__earnedBadge" aria-label={t('lifetime.earnedAria')}>
                        {t('lifetime.earnedTag')}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
