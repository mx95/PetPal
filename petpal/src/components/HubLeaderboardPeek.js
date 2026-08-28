import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { fetchPublicLeaderboard } from '../leaderboard/publicWalkFirestore';
import { leaderboardRowLabel } from '../leaderboard/leaderboardLabels';

function formatKm(n) {
  if (n == null || Number.isNaN(n)) return '0.0';
  return (Math.round(Number(n) * 10) / 10).toFixed(1);
}

export default function HubLeaderboardPeek() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchPublicLeaderboard();
        data.sort((a, b) => (Number(b.kmWeek) || 0) - (Number(a.kmWeek) || 0));
        if (!cancelled) setRows(data.slice(0, 3));
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="pp-hubLb" aria-labelledby="pp-hubLb-title">
      <div className="pp-hubLb__head">
        <span className="pp-publicHero__eyebrow" style={{ display: 'inline-block', width: 'fit-content' }}>
          🏆
        </span>
        <h2 id="pp-hubLb-title" className="pp-feed__sectionTitle" style={{ margin: '8px 0 4px' }}>
          {t('activityHub.leaderboardPeekTitle')}
        </h2>
        <p className="pp-subtle" style={{ margin: '0 0 14px', maxWidth: 520 }}>
          {t('activityHub.leaderboardPeekSub')}
        </p>
      </div>
      {loading ? <p className="pp-subtle">{t('common.loading')}</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="pp-subtle pp-hubLb__empty">{t('activityHub.leaderboardPeekEmpty')}</p>
      ) : null}
      {!loading && rows.length > 0 ? (
        <ul className="pp-hubLb__podium">
          {rows.map((r, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
            const isYou = r.id === user?.uid;
            return (
              <li key={r.id} className={`pp-hubLb__slot ${isYou ? 'pp-hubLb__slot--me' : ''}`}>
                <span className="pp-hubLb__medal" aria-hidden>
                  {medal}
                </span>
                <div className="pp-hubLb__avatarWrap">
                  <span className="pp-hubLb__fakeAvatar pp-hubLb__fakeAvatar--letter" aria-hidden>
                    {(r.displayName || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="pp-hubLb__name">{leaderboardRowLabel(r)}</span>
                <span className="pp-hubLb__km">
                  {formatKm(r.kmWeek)} {t('leaderboardPage.tblKmSuffix')}
                </span>
                {isYou ? <span className="pp-hubLb__you">{t('leaderboardPage.tblYouBadge')}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <Link className="pp-btn pp-btnPrimary" to="/leaderboard" style={{ textDecoration: 'none', marginTop: 16, display: 'inline-flex', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
        {t('activityHub.leaderboardCta')}
      </Link>
    </section>
  );
}
