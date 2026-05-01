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

  const onToggle = async (e) => {
    const next = e.target.checked;
    setSaving(true);
    try {
      await setShareOnLeaderboard(next);
    } catch {
      // state stays
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div
            className="pp-row"
            style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}
          >
            <div>
              <h1 className="pp-h1" style={{ marginTop: 0 }}>
                {t('leaderboardPage.title')}
              </h1>
              <p className="pp-subtle" style={{ marginTop: 8, maxWidth: 560 }}>
                {t('leaderboardPage.introStart')}{' '}
                <Link to="/dashboard" className="pp-link" style={{ display: 'inline', padding: 0 }}>
                  {t('leaderboardPage.introDashLink')}
                </Link>
                {t('leaderboardPage.introEnd')}
              </p>
            </div>
            <Link className="pp-btn" to="/dashboard" style={{ textDecoration: 'none' }}>
              {t('leaderboardPage.backBtn')}
            </Link>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ borderColor: 'rgba(91, 55, 255, 0.2)' }}>
          <h2 className="pp-sectionTitle">{t('leaderboardPage.privacyHeading')}</h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            {t('leaderboardPage.privacyBody')}
          </p>
          {!isFirestoreEnabled ? (
            <p className="pp-subtle" style={{ color: '#b42318' }}>
              {t('leaderboardPage.firebaseWarn')}
            </p>
          ) : (
            <label className="pp-row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={shareOnLeaderboard}
                disabled={!shareLoaded || saving}
                onChange={onToggle}
              />
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
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
              {t('leaderboardPage.rankingsHeading')}
            </h2>
            <div className="pp-lbSegment">
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
            <button type="button" className="pp-btn" onClick={load} disabled={loading}>
              {loading ? t('common.loading') : t('leaderboardPage.refresh')}
            </button>
          </div>
          {loadError ? <p style={{ color: '#b42318' }}>{loadError}</p> : null}
          {loading && rows.length === 0 ? <p className="pp-subtle">{t('common.loading')}</p> : null}
          {!loading && !loadError && rows.length === 0 && isFirestoreEnabled ? (
            <p className="pp-subtle">{t('leaderboardPage.emptySharers')}</p>
          ) : null}
          {rows.length > 0 ? (
            <div className="pp-lbTableWrap">
              <table className="pp-lbTable">
                <thead>
                  <tr>
                    <th>{t('leaderboardPage.tblRank')}</th>
                    <th>{t('leaderboardPage.tblName')}</th>
                    <th className="pp-lbTable__num">{currentPeriodLabel || t('leaderboardPage.tblKmSuffix')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const v = r[key] ?? 0;
                    const isYou = r.id === user?.uid;
                    return (
                      <tr key={r.id} className={isYou ? 'pp-lbTable__row--me' : ''}>
                        <td>{i + 1}</td>
                        <td>
                          {r.displayName}
                          {isYou ? t('leaderboardPage.tblYouBadge') : ''}
                        </td>
                        <td className="pp-lbTable__num">
                          {formatKm(v)} {t('leaderboardPage.tblKmSuffix')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-lbAch">
          <div
            className="pp-row"
            style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}
          >
            <div>
              <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
                {t('leaderboardPage.achTitle')}
              </h2>
              <p className="pp-subtle" style={{ marginTop: 8, maxWidth: 640 }}>
                {t('leaderboardPage.achIntroStart')}
              </p>
            </div>
          </div>
          {!loading && !loadError && achievementRows.length === 0 && isFirestoreEnabled ? (
            <p className="pp-subtle">{t('leaderboardPage.achEmpty')}</p>
          ) : null}
          {achievementRows.length > 0 ? (
            <div className="pp-lbTableWrap">
              <table className="pp-lbTable pp-lbTable--ach">
                <thead>
                  <tr>
                    <th>{t('leaderboardPage.tblRank')}</th>
                    <th>{t('leaderboardPage.tblName')}</th>
                    <th className="pp-lbTable__num">{t('leaderboardPage.achTblXp')}</th>
                    <th className="pp-lbTable__num">{t('leaderboardPage.achTblBadges')}</th>
                    <th className="pp-lbTable__num">{t('leaderboardPage.achTblLevel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {achievementRows.map((r, i) => {
                    const isYou = r.id === user?.uid;
                    const ax = Math.round(Number(r.achievementXp) || 0);
                    const ac = Math.round(Number(r.achievementCount) || 0);
                    const at = Math.round(Number(r.achievementTotal) || 0);
                    const lvl = Math.max(1, Math.round(Number(r.level) || 1));
                    return (
                      <tr key={`ach-${r.id}`} className={isYou ? 'pp-lbTable__row--me' : ''}>
                        <td>{i + 1}</td>
                        <td>
                          {r.displayName}
                          {isYou ? t('leaderboardPage.tblYouBadge') : ''}
                        </td>
                        <td className="pp-lbTable__num">{ax}</td>
                        <td className="pp-lbTable__num">
                          {ac}
                          {at > 0 ? ` / ${at}` : ''}
                        </td>
                        <td className="pp-lbTable__num">{lvl}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
