import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useGame } from '../game/GameContext';
import { usePublicWalk } from '../leaderboard/PublicWalkContext';
import { fetchPublicLeaderboard } from '../leaderboard/publicWalkFirestore';

const PERIODS = [
  { id: 'day', label: 'Today', key: 'kmDay' },
  { id: 'week', label: 'This week', key: 'kmWeek' },
  { id: 'year', label: 'This year', key: 'kmYear' },
];

function formatKm(n) {
  if (n == null || Number.isNaN(n)) return '0.0';
  return (Math.round(n * 10) / 10).toFixed(1);
}

export default function Leaderboard() {
  const { user } = useAuth();
  const { walkTotals } = useGame();
  const { shareOnLeaderboard, shareLoaded, setShareOnLeaderboard, lastSyncError, isFirestoreEnabled } = usePublicWalk();
  const [period, setPeriod] = useState('week');
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const key = useMemo(() => PERIODS.find((p) => p.id === period)?.key || 'kmWeek', [period]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPublicLeaderboard();
      const k = key;
      data.sort((a, b) => (b[k] || 0) - (a[k] || 0));
      setRows(data);
    } catch (e) {
      setLoadError(e?.message || 'Could not load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const yourRank = useMemo(() => {
    if (!user?.uid) return null;
    const i = rows.findIndex((r) => r.id === user.uid);
    return i >= 0 ? i + 1 : null;
  }, [rows, user?.uid]);

  const onToggle = async (e) => {
    const next = e.target.checked;
    setSaving(true);
    try {
      await setShareOnLeaderboard(next);
    } catch {
      // state stays; checkbox may need revert
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <h1 className="pp-h1" style={{ marginTop: 0 }}>
                Walk leaderboard
              </h1>
              <p className="pp-subtle" style={{ marginTop: 8, maxWidth: 560 }}>
                Compare total walking distance with other caregivers. Only people who turn on sharing appear here. Your
                stats come from the distances you log on the{' '}
                <Link to="/dashboard" className="pp-link" style={{ display: 'inline', padding: 0 }}>
                  dashboard
                </Link>
                .
              </p>
            </div>
            <Link className="pp-btn" to="/dashboard" style={{ textDecoration: 'none' }}>
              ← Back
            </Link>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ borderColor: 'rgba(91, 55, 255, 0.2)' }}>
          <h2 className="pp-sectionTitle">Your privacy</h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            You choose whether to appear on the public leaderboard. Other users only see a display name and your listed
            distances (today / this week / this year) — not your email or your pets, unless you share that elsewhere.
          </p>
          {!isFirestoreEnabled ? (
            <p className="pp-subtle" style={{ color: '#b42318' }}>
              Firebase project is not configured in this build, so the leaderboard can&apos;t sync. Set
              <code> REACT_APP_FIREBASE_* </code>
              in <code>.env</code> and deploy Firestore security rules to enable it.
            </p>
          ) : (
            <label className="pp-row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={shareOnLeaderboard}
                disabled={!shareLoaded || saving}
                onChange={onToggle}
              />
              <span style={{ fontWeight: 700 }}>Show my walk distances on the global leaderboard</span>
            </label>
          )}
          {lastSyncError ? <p style={{ color: '#b42318', marginTop: 8, fontSize: 14 }}>{lastSyncError}</p> : null}
          <p className="pp-subtle" style={{ marginTop: 10, fontSize: 13 }}>
            Your current totals: today <strong>{formatKm(walkTotals.day)} km</strong>, this week{' '}
            <strong>{formatKm(walkTotals.week)} km</strong>, this year <strong>{formatKm(walkTotals.year)} km</strong>
            {shareOnLeaderboard && yourRank != null ? (
              <>
                {' '}
                · your rank (this view): <strong>#{yourRank}</strong>
              </>
            ) : null}
            .
          </p>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
              Rankings
            </h2>
            <div className="pp-lbSegment">
              {PERIODS.map((p) => (
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
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          {loadError ? <p style={{ color: '#b42318' }}>{loadError}</p> : null}
          {loading && rows.length === 0 ? <p className="pp-subtle">Loading…</p> : null}
          {!loading && !loadError && rows.length === 0 && isFirestoreEnabled ? (
            <p className="pp-subtle">No one is sharing yet — be the first, or check back after others opt in.</p>
          ) : null}
          {rows.length > 0 ? (
            <div className="pp-lbTableWrap">
              <table className="pp-lbTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th className="pp-lbTable__num">{PERIODS.find((p) => p.id === period)?.label || 'km'}</th>
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
                          {isYou ? ' · you' : ''}
                        </td>
                        <td className="pp-lbTable__num">{formatKm(v)} km</td>
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
