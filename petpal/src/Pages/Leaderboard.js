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

function RowAvatar({ name }) {
  return (
    <span className="pp-lbCard__avatar" aria-hidden>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
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
  const gapKm =
    aheadRow && myRow != null ? Math.max(0, (Number(aheadRow[key]) || 0) - myVal) : null;

  const onToggle = async (e) => {
    const next = e.target.checked;
    setSaving(true);
    try {
      await setShareOnLeaderboard(next);
    } finally {
      setSaving(false);
    }
  };

  const showPodium = !loading && rowsWithKm.length > 0;

  return (
    <div className="pp-feed pp-lb-page">
      <header className="pp-lb-hero pp-card pp-pad">
        <span className="pp-lb-hero__emoji" aria-hidden>
          {t('leaderboardPage.heroEmoji')}
        </span>
        <h1 className="pp-lb-hero__title">{t('leaderboardPage.heroTitle')}</h1>
        <p className="pp-lb-hero__sub">{t('leaderboardPage.heroSub')}</p>
        <p className="pp-subtle pp-lb-hero__intro">
          {t('leaderboardPage.introStart')}{' '}
          <Link to="/dashboard" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {t('leaderboardPage.introDashLink')}
          </Link>
          {t('leaderboardPage.introEnd')}
        </p>
        <Link className="pp-btn pp-btn--ghost pp-lb-hero__back" to="/dashboard" style={{ textDecoration: 'none' }}>
          {t('common.backDashboard')}
        </Link>
      </header>

      <section className="pp-card pp-pad pp-lb-privacy">
        <h2 className="pp-sectionTitle">{t('leaderboardPage.privacyHeading')}</h2>
        <p className="pp-subtle" style={{ marginBottom: 12 }}>
          {t('leaderboardPage.privacyBody')}
        </p>
        {!isFirestoreEnabled ? (
          <p className="pp-subtle" style={{ color: '#b42318' }}>
            {t('leaderboardPage.firebaseWarn')}
          </p>
        ) : (
          <label className="pp-row pp-lb-privacyOpt" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={shareOnLeaderboard} disabled={!shareLoaded || saving} onChange={onToggle} />
            <span style={{ fontWeight: 700 }}>{t('leaderboardPage.optInCheckbox')}</span>
          </label>
        )}
        {lastSyncError ? <p style={{ color: '#b42318', marginTop: 8, fontSize: 14 }}>{lastSyncError}</p> : null}
        <p className="pp-subtle" style={{ marginTop: 10, fontSize: 13 }}>
          {t('leaderboardPage.totalsLine', {
            today: formatKm(walkTotals.day),
            week: formatKm(walkTotals.week),
            year: formatKm(walkTotals.year),
          })}
          {shareOnLeaderboard && yourRank != null ? (
            <> {t('leaderboardPage.rankSuffix', { rank: yourRank })}</>
          ) : null}
        </p>
      </section>

      <section className="pp-lb-toolbar pp-card pp-pad">
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
        <button type="button" className="pp-btn pp-btn--ghost" onClick={load} disabled={loading}>
          {loading ? t('common.loading') : t('leaderboardPage.refresh')}
        </button>
      </section>

      {loadError ? <p className="pp-error pp-lb-error">{loadError}</p> : null}
      {loading && rows.length === 0 ? <p className="pp-subtle pp-lb-loading">{t('common.loading')}</p> : null}
      {!loading && !loadError && rows.length === 0 && isFirestoreEnabled ? (
        <p className="pp-subtle pp-lb-empty">{t('leaderboardPage.podiumEmpty')}</p>
      ) : null}
      {!loading && !loadError && rows.length > 0 && rowsWithKm.length === 0 && isFirestoreEnabled ? (
        <p className="pp-subtle pp-lb-empty">{t('leaderboardPage.emptySharers')}</p>
      ) : null}

      {showPodium ? (
        <>
          <h2 className="pp-feed__sectionTitle">{t('leaderboardPage.rankingsHeading')}</h2>
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
                  <RowAvatar name={r.displayName} />
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
        </>
      ) : null}

      {shareOnLeaderboard && myRow && yourRank != null ? (
        <div className="pp-card pp-pad pp-lb-meCard">
          <div className="pp-lb-meCard__row">
            <div>
              <span className="pp-lifetime__eyebrow">{t('leaderboardPage.myPositionHeading')}</span>
              <div className="pp-lb-meCard__rank">#{yourRank}</div>
              <div className="pp-lb-meCard__km">
                {formatKm(myRow[key])}{' '}
                <span>
                  {t('leaderboardPage.tblKmSuffix')} · {currentPeriodLabel}
                </span>
              </div>
            </div>
            <RowAvatar name={myRow.displayName} />
          </div>
          {gapKm != null && gapKm > 0 && aheadRow ? (
            <p className="pp-subtle pp-lb-meCard__hint">
              {t('leaderboardPage.nextRankGap', { km: formatKm(gapKm), rank: yourRank - 1 })}
            </p>
          ) : yourRank === 1 && rowsWithKm.length > 0 ? (
            <p className="pp-subtle pp-lb-meCard__hint">{t('leaderboardPage.leadingPack')}</p>
          ) : null}
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <section className="pp-lb-listSection">
          <h2 className="pp-feed__sectionTitle">{t('leaderboardPage.listHeadingWalk', { period: currentPeriodLabel })}</h2>
          <ul className="pp-lb-cards">
            {rows.map((r, i) => {
              const v = r[key] ?? 0;
              const isYou = r.id === user?.uid;
              return (
                <li key={r.id} className={`pp-lb-card ${isYou ? 'pp-lb-card--me' : ''}`}>
                  <span className="pp-lb-card__rank">#{i + 1}</span>
                  <RowAvatar name={r.displayName} />
                  <div className="pp-lb-card__body">
                    <span className="pp-lb-card__name">
                      {r.displayName}
                      {isYou ? <span className="pp-lb-card__badge">{t('leaderboardPage.tblYouBadge')}</span> : null}
                    </span>
                  </div>
                  <span className="pp-lb-card__stat">
                    {formatKm(v)} {t('leaderboardPage.tblKmSuffix')}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="pp-lb-achSection">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">{t('leaderboardPage.achTitle')}</h2>
          <p className="pp-subtle pp-lb-achLead">{t('leaderboardPage.achIntroStart')}</p>
          {!loading && !loadError && achievementRows.length === 0 && isFirestoreEnabled ? (
            <p className="pp-subtle">{t('leaderboardPage.achEmpty')}</p>
          ) : null}
          <ul className="pp-lb-achCards">
            {achievementRows.map((r, i) => {
              const isYou = r.id === user?.uid;
              const ax = Math.round(Number(r.achievementXp) || 0);
              const ac = Math.round(Number(r.achievementCount) || 0);
              const at = Math.round(Number(r.achievementTotal) || 0);
              const lvl = Math.max(1, Math.round(Number(r.level) || 1));
              return (
                <li key={`ach-${r.id}`} className={`pp-lb-achCard ${isYou ? 'pp-lb-achCard--me' : ''}`}>
                  <span className="pp-lb-achCard__rank">#{i + 1}</span>
                  <RowAvatar name={r.displayName} />
                  <div className="pp-lb-achCard__main">
                    <span className="pp-lb-achCard__name">
                      {r.displayName}
                      {isYou ? <span className="pp-lb-card__badge">{t('leaderboardPage.tblYouBadge')}</span> : null}
                    </span>
                    <div className="pp-lb-achCard__stats">
                      <span>{ax} XP</span>
                      <span>
                        {ac}
                        {at > 0 ? ` / ${at}` : ''}{' '}
                        {t('leaderboardPage.achTblBadges')}
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
        </div>
      </section>
    </div>
  );
}
