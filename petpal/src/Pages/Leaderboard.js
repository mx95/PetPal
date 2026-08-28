import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { usePublicWalk } from '../leaderboard/PublicWalkContext';
import { fetchPublicLeaderboard } from '../leaderboard/publicWalkFirestore';
import { leaderboardRowLabel } from '../leaderboard/leaderboardLabels';
import { EmptyState, PageContainer, PetIllustration, SegmentedTabs, SkeletonCard } from '../components/ui';

function formatKm(n) {
  if (n == null || Number.isNaN(n)) return '0.0';
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Podium order: 2nd, 1st, 3rd for visual center emphasis */
function podiumThree(rows) {
  if (!rows?.length) return [null, null, null];
  if (rows.length === 1) return [null, rows[0], null];
  if (rows.length === 2) return [rows[1], rows[0], null];
  return [rows[1], rows[0], rows[2]];
}

/**
 * @param {{ name: string, variant?: 'row' | 'podium' | 'me' }} props
 */
function LbAvatar({ name, variant = 'row' }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span className={`pp-lb-avatar pp-lb-avatar--${variant}`} aria-hidden>
      {letter}
    </span>
  );
}

/**
 * @param {{ rank: number, compact?: boolean }} props
 */
function RankBadge({ rank, compact = false }) {
  const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'default';
  return (
    <span
      className={`pp-lb-rankBadge pp-lb-rankBadge--${tier} ${compact ? 'pp-lb-rankBadge--sm' : ''}`.trim()}
      aria-hidden
    >
      #{rank}
    </span>
  );
}

/**
 * @param {{
 *   row: Record<string, unknown>,
 *   rank: number,
 *   km: number,
 *   maxKm: number,
 *   isYou: boolean,
 *   t: (k: string, v?: object) => string,
 * }} props
 */
function WalkLeaderboardRow({ row, rank, km, maxKm, isYou, t }) {
  const pct = Math.min(100, Math.round((km / maxKm) * 100));
  const label = leaderboardRowLabel(row);
  return (
    <li
      className={`pp-lb-row ${isYou ? 'pp-lb-row--me' : ''} ${rank <= 3 ? `pp-lb-row--place-${rank}` : ''}`}
    >
      <div className="pp-lb-row__rankCol">
        <RankBadge rank={rank} />
      </div>
      <LbAvatar name={label} variant="row" />
      <div className="pp-lb-row__main">
        <div className="pp-lb-row__nameRow">
          <span className="pp-lb-row__name">{label}</span>
          {isYou ? <span className="pp-lb-row__you">{t('leaderboardPage.tblYouBadge')}</span> : null}
        </div>
        <div
          className="pp-lb-row__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t('leaderboardPage.progressAria')}
        >
          <div className="pp-lb-row__barFill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="pp-lb-row__stat">
        <span className="pp-lb-row__statVal">{formatKm(km)}</span>
        <span className="pp-lb-row__statUnit">{t('leaderboardPage.tblKmSuffix')}</span>
      </div>
    </li>
  );
}

/**
 * @param {{ children: React.ReactNode, className?: string, hover?: boolean }} props
 */
function LbSurface({ children, className = '', hover = true }) {
  return <div className={`pp-lb-surface ${hover ? 'pp-lb-surface--hover' : ''} ${className}`.trim()}>{children}</div>;
}

export default function Leaderboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { shareOnLeaderboard, shareLoaded, setShareOnLeaderboard, lastSyncError, isFirestoreEnabled } = usePublicWalk();
  const [period, setPeriod] = useState('week');
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const periods = useMemo(
    () => [
      { id: 'day', label: t('leaderboardPage.periodToday'), key: 'kmDay' },
      { id: 'week', label: t('leaderboardPage.periodWeek'), key: 'kmWeek' },
      { id: 'year', label: t('leaderboardPage.periodYear'), key: 'kmYear' },
    ],
    [t]
  );

  const key = useMemo(() => periods.find((p) => p.id === period)?.key || 'kmWeek', [period, periods]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPublicLeaderboard();
      const k = key;
      data.sort((a, b) => (b[k] || 0) - (a[k] || 0));
      setRows(data);
    } catch (e) {
      setLoadError(e?.message || t('leaderboardPage.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [key, t]);

  useEffect(() => {
    load();
  }, [load]);

  const yourRank = useMemo(() => {
    if (!user?.uid) return null;
    const i = rows.findIndex((r) => r.id === user.uid);
    return i >= 0 ? i + 1 : null;
  }, [rows, user?.uid]);

  const achievementRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ax = Number(a.achievementXp) || 0;
      const bx = Number(b.achievementXp) || 0;
      if (bx !== ax) return bx - ax;
      const ac = Number(a.achievementCount) || 0;
      const bc = Number(b.achievementCount) || 0;
      if (bc !== ac) return bc - ac;
      return (Number(b.level) || 0) - (Number(a.level) || 0);
    });
  }, [rows]);

  const currentPeriodLabel = useMemo(() => periods.find((p) => p.id === period)?.label || '', [periods, period]);
  const rowsWithKm = useMemo(() => rows.filter((r) => (Number(r[key]) || 0) > 0), [rows, key]);
  const [p2, p1, p3] = podiumThree(rowsWithKm);

  const myRow = useMemo(() => rows.find((r) => r.id === user?.uid), [rows, user?.uid]);
  const myVal = myRow ? Number(myRow[key] || 0) : 0;
  const aheadRow = yourRank != null && yourRank > 1 ? rows[yourRank - 2] : null;
  const gapKm = aheadRow && myRow != null ? Math.max(0, (Number(aheadRow[key]) || 0) - myVal) : null;

  const maxWalkKm = useMemo(() => {
    if (!rows.length) return 1;
    return Math.max(1, ...rows.map((r) => Number(r[key]) || 0));
  }, [rows, key]);

  const onShareToggle = async (next) => {
    setSaving(true);
    try {
      await setShareOnLeaderboard(next);
    } finally {
      setSaving(false);
    }
  };

  const showPodium = !loading && rowsWithKm.length > 0;

  return (
    <PageContainer className="animate-fade-up">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-lift backdrop-blur sm:p-10">
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-petpal-soft blur-3xl" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_260px] lg:items-center">
            <div>
              <span className="mb-4 inline-flex rounded-full bg-petpal-soft px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-petpal-lilac">{t('leaderboardPage.rankingsHeading')}</span>
              <h1 className="text-4xl font-black tracking-[-0.06em] text-petpal-ink sm:text-6xl">{t('leaderboardPage.heroTitle')}</h1>
            </div>
            <PetIllustration variant="trophy" className="mx-auto h-56 w-56" />
          </div>
        </section>

        <LbSurface hover={false} className="pp-lb-privacy">
          {!isFirestoreEnabled ? (
            <p className="pp-lb-warn">{t('leaderboardPage.firebaseWarn')}</p>
          ) : (
            <div className="pp-lb-switchRow">
              <button
                type="button"
                className="pp-lb-switch"
                role="switch"
                aria-checked={shareOnLeaderboard}
                aria-label={t('leaderboardPage.optInSwitchAria')}
                disabled={!shareLoaded || saving}
                onClick={() => onShareToggle(!shareOnLeaderboard)}
              />
              <span className="pp-lb-switchLabel">{t('leaderboardPage.optInCheckbox')}</span>
            </div>
          )}
          {lastSyncError ? <p className="pp-lb-warn pp-lb-warn--mt">{lastSyncError}</p> : null}
        </LbSurface>

        <LbSurface className="pp-lb-toolbar">
          <SegmentedTabs tabs={periods} value={period} onChange={setPeriod} ariaLabel={t('leaderboardPage.rankingsHeading')} />
          <button type="button" className="pp-lb-btn pp-lb-btn--primary pp-lb-btn--sm" onClick={load} disabled={loading}>
            {loading ? t('common.loading') : t('leaderboardPage.refresh')}
          </button>
        </LbSurface>

        {loadError ? <p className="pp-lb-error">{loadError}</p> : null}
        {loading && rows.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}
        {!loading && !loadError && rows.length === 0 && isFirestoreEnabled ? (
          <EmptyState title={t('leaderboardPage.podiumEmpty')} body={t('leaderboardPage.emptySharers')} icon="trophy" />
        ) : null}
        {!loading && !loadError && rows.length > 0 && rowsWithKm.length === 0 && isFirestoreEnabled ? (
          <EmptyState title={t('leaderboardPage.emptySharers')} body={t('leaderboardPage.optInCheckbox')} icon="trophy" />
        ) : null}

        {showPodium ? (
          <section className="pp-lb-section">
            <h2 className="pp-lb-sectionTitle">{t('leaderboardPage.rankingsHeading')}</h2>
            <div className="pp-lb-podium">
              {[p2, p1, p3].map((r, idx) => {
                const medals = ['🥈', '🥇', '🥉'];
                const heights = ['pp-lb-podium__block--silver', 'pp-lb-podium__block--gold', 'pp-lb-podium__block--bronze'];
                const rankNums = [2, 1, 3];
                if (!r) {
                  return (
                    <div key={`empty-${idx}`} className={`pp-lb-podium__block ${heights[idx]} pp-lb-podium__block--empty`}>
                      <span className="pp-lb-podium__medal" aria-hidden>
                        {medals[idx]}
                      </span>
                      <span className="pp-lb-podium__empty">—</span>
                    </div>
                  );
                }
                const isYou = r.id === user?.uid;
                const label = leaderboardRowLabel(r);
                return (
                  <div key={r.id} className={`pp-lb-podium__block ${heights[idx]} ${isYou ? 'pp-lb-podium__block--me' : ''}`}>
                    <span className="pp-lb-podium__medal" aria-hidden>
                      {medals[idx]}
                    </span>
                    <LbAvatar name={label} variant="podium" />
                    <span className="pp-lb-podium__name">{label}</span>
                    <span className="pp-lb-podium__km">
                      {formatKm(r[key])} {t('leaderboardPage.tblKmSuffix')}
                    </span>
                    <span className="pp-lb-podium__rank">#{rankNums[idx]}</span>
                    {isYou ? <span className="pp-lb-podium__you">{t('leaderboardPage.tblYouBadge')}</span> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {shareOnLeaderboard && myRow && yourRank != null ? (
          <LbSurface hover={false} className="pp-lb-meCard">
            <span className="pp-lb-meCard__badge">{t('leaderboardPage.yourPositionBadge')}</span>
            <div className="pp-lb-meCard__row">
              <div>
                <span className="pp-lb-meCard__eyebrow">{t('leaderboardPage.myPositionHeading')}</span>
                <div className="pp-lb-meCard__rank">#{yourRank}</div>
                <div className="pp-lb-meCard__km">
                  {formatKm(myRow[key])}{' '}
                  <span>
                    {t('leaderboardPage.tblKmSuffix')} · {currentPeriodLabel}
                  </span>
                </div>
              </div>
              <LbAvatar name={leaderboardRowLabel(myRow)} variant="me" />
            </div>
            {gapKm != null && gapKm > 0 && aheadRow ? (
              <p className="pp-lb-meCard__hint">
                {t('leaderboardPage.nextRankGap', { km: formatKm(gapKm), rank: yourRank - 1 })}
              </p>
            ) : yourRank === 1 && rowsWithKm.length > 0 ? (
              <p className="pp-lb-meCard__hint">{t('leaderboardPage.leadingPack')}</p>
            ) : null}
          </LbSurface>
        ) : null}

        {!loading && rows.length > 0 ? (
          <section className="pp-lb-section">
            <h2 className="pp-lb-sectionTitle">{t('leaderboardPage.listHeadingWalk', { period: currentPeriodLabel })}</h2>
            <LbSurface hover={false} className="pp-lb-listWrap">
              <ul className="pp-lb-rows">
                {rows.map((r, i) => {
                  const v = r[key] ?? 0;
                  const isYou = r.id === user?.uid;
                  return (
                    <WalkLeaderboardRow
                      key={r.id}
                      row={r}
                      rank={i + 1}
                      km={Number(v) || 0}
                      maxKm={maxWalkKm}
                      isYou={isYou}
                      t={t}
                    />
                  );
                })}
              </ul>
            </LbSurface>
          </section>
        ) : null}

        <section className="pp-lb-section">
          <LbSurface hover={false} className="pp-lb-ach">
            <h2 className="pp-lb-h2">{t('leaderboardPage.achTitle')}</h2>
            {!loading && !loadError && achievementRows.length === 0 && isFirestoreEnabled ? (
              <p className="pp-lb-muted">{t('leaderboardPage.achEmpty')}</p>
            ) : null}
            <ul className="pp-lb-achRows">
              {achievementRows.map((r, i) => {
                const isYou = r.id === user?.uid;
                const label = leaderboardRowLabel(r);
                return (
                  <li key={`ach-${r.id}`} className={`pp-lb-achRow ${isYou ? 'pp-lb-achRow--me' : ''}`}>
                    <div className="pp-lb-achRow__rank">
                      <RankBadge rank={i + 1} compact />
                    </div>
                    <LbAvatar name={label} variant="row" />
                    <div className="pp-lb-achRow__main">
                      <span className="pp-lb-achRow__name">
                        {label}
                        {isYou ? <span className="pp-lb-row__you">{t('leaderboardPage.tblYouBadge')}</span> : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </LbSurface>
        </section>
      </div>
    </PageContainer>
  );
}
