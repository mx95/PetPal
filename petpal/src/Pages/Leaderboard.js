import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useGame } from '../game/GameContext';
import { usePublicWalk } from '../leaderboard/PublicWalkContext';
import { fetchPublicLeaderboard } from '../leaderboard/publicWalkFirestore';

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
  const label = String(row.displayName || '?');
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
  const { walkTotals } = useGame();
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
    return [...rows]
      .filter((r) => (Number(r.achievementXp) || 0) > 0 || (Number(r.achievementCount) || 0) > 0)
      .sort((a, b) => {
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
    <div className="pp-lb-shell">
      <div className="pp-lb-page pp-lb-page--v2">
        <LbSurface hover={false} className="pp-lb-hero">
          <div className="pp-lb-hero__top">
            <span className="pp-lb-hero__emoji" aria-hidden>
              {t('leaderboardPage.heroEmoji')}
            </span>
            <span className="pp-lb-hero__spark" aria-hidden>
              ✨
            </span>
          </div>
          <h1 className="pp-lb-hero__title">{t('leaderboardPage.heroTitle')}</h1>
          <p className="pp-lb-hero__sub">{t('leaderboardPage.heroSub')}</p>
          <p className="pp-lb-hero__intro">
            {t('leaderboardPage.introStart')}{' '}
            <Link to="/dashboard" className="pp-lb-hero__link">
              {t('leaderboardPage.introDashLink')}
            </Link>
            {t('leaderboardPage.introEnd')}
          </p>
          <Link className="pp-lb-btn pp-lb-btn--primary" to="/dashboard">
            {t('common.backDashboard')}
          </Link>
        </LbSurface>

        <LbSurface hover={false} className="pp-lb-privacy">
          <h2 className="pp-lb-h2">{t('leaderboardPage.privacyHeading')}</h2>
          <p className="pp-lb-lead">{t('leaderboardPage.privacyBody')}</p>
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
          <p className="pp-lb-meta">
            {t('leaderboardPage.totalsLine', {
              today: formatKm(walkTotals.day),
              week: formatKm(walkTotals.week),
              year: formatKm(walkTotals.year),
            })}
            {shareOnLeaderboard && yourRank != null ? (
              <> {t('leaderboardPage.rankSuffix', { rank: yourRank })}</>
            ) : null}
          </p>
        </LbSurface>

        <LbSurface className="pp-lb-toolbar">
          <div className="pp-lbSegment" role="group" aria-label={t('leaderboardPage.rankingsHeading')}>
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pp-lbSegment__btn ${period === p.id ? 'pp-lbSegment__btn--on' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" className="pp-lb-btn pp-lb-btn--primary pp-lb-btn--sm" onClick={load} disabled={loading}>
            {loading ? t('common.loading') : t('leaderboardPage.refresh')}
          </button>
        </LbSurface>

        {loadError ? <p className="pp-lb-error">{loadError}</p> : null}
        {loading && rows.length === 0 ? <p className="pp-lb-muted">{t('common.loading')}</p> : null}
        {!loading && !loadError && rows.length === 0 && isFirestoreEnabled ? (
          <p className="pp-lb-muted">{t('leaderboardPage.podiumEmpty')}</p>
        ) : null}
        {!loading && !loadError && rows.length > 0 && rowsWithKm.length === 0 && isFirestoreEnabled ? (
          <p className="pp-lb-muted">{t('leaderboardPage.emptySharers')}</p>
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
                return (
                  <div key={r.id} className={`pp-lb-podium__block ${heights[idx]} ${isYou ? 'pp-lb-podium__block--me' : ''}`}>
                    <span className="pp-lb-podium__medal" aria-hidden>
                      {medals[idx]}
                    </span>
                    <LbAvatar name={r.displayName} variant="podium" />
                    <span className="pp-lb-podium__name">{r.displayName}</span>
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
              <LbAvatar name={myRow.displayName} variant="me" />
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
            <p className="pp-lb-lead pp-lb-lead--tight">{t('leaderboardPage.achIntroStart')}</p>
            {!loading && !loadError && achievementRows.length === 0 && isFirestoreEnabled ? (
              <p className="pp-lb-muted">{t('leaderboardPage.achEmpty')}</p>
            ) : null}
            <ul className="pp-lb-achRows">
              {achievementRows.map((r, i) => {
                const isYou = r.id === user?.uid;
                const ax = Math.round(Number(r.achievementXp) || 0);
                const ac = Math.round(Number(r.achievementCount) || 0);
                const at = Math.round(Number(r.achievementTotal) || 0);
                const lvl = Math.max(1, Math.round(Number(r.level) || 1));
                return (
                  <li key={`ach-${r.id}`} className={`pp-lb-achRow ${isYou ? 'pp-lb-achRow--me' : ''}`}>
                    <div className="pp-lb-achRow__rank">
                      <RankBadge rank={i + 1} compact />
                    </div>
                    <LbAvatar name={r.displayName} variant="row" />
                    <div className="pp-lb-achRow__main">
                      <span className="pp-lb-achRow__name">
                        {r.displayName}
                        {isYou ? <span className="pp-lb-row__you">{t('leaderboardPage.tblYouBadge')}</span> : null}
                      </span>
                      <div className="pp-lb-achRow__stats">
                        <span>{ax} XP</span>
                        <span>
                          {ac}
                          {at > 0 ? ` / ${at}` : ''} {t('leaderboardPage.achTblBadges')}
                        </span>
                        <span>
                          {t('leaderboardPage.achTblLevel')} {lvl}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </LbSurface>
        </section>
      </div>
    </div>
  );
}
