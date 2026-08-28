import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from '../pets/PetsContext';
import { useI18n } from '../i18n/I18nContext';
import { fetchPublicLeaderboard } from '../leaderboard/publicWalkFirestore';
import { enrichLeaderboardRow } from '../leaderboard/leaderboardRowUtils';
import { LeaderboardPairNames, LeaderboardPairVisual } from './leaderboard/LeaderboardPairVisual';

function formatKm(n) {
  if (n == null || Number.isNaN(n)) return '0.0';
  return (Math.round(Number(n) * 10) / 10).toFixed(1);
}

function rankMedal(idx) {
  if (idx === 0) return '🥇';
  if (idx === 1) return '🥈';
  if (idx === 2) return '🥉';
  return null;
}

export default function HubLeaderboardPeek() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { pets } = usePets();
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

  const enrichedRows = useMemo(
    () => rows.map((row) => enrichLeaderboardRow(row, user, pets)).filter(Boolean),
    [rows, user, pets]
  );

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
      {!loading && enrichedRows.length === 0 ? (
        <p className="pp-subtle pp-hubLb__empty">{t('activityHub.leaderboardPeekEmpty')}</p>
      ) : null}
      {!loading && enrichedRows.length > 0 ? (
        <ul className="pp-hubLb__podium pp-hubLb__podium--social">
          {enrichedRows.map((r, idx) => {
            const isYou = r.id === user?.uid;
            const medal = rankMedal(idx);
            return (
              <li key={r.id} className={`pp-hubLb__slot pp-hubLb__slot--social ${isYou ? 'pp-hubLb__slot--me' : ''}`}>
                {medal ? (
                  <span className="pp-hubLb__medal" aria-hidden>
                    {medal}
                  </span>
                ) : null}
                <LeaderboardPairVisual
                  ownerName={r.displayName}
                  petName={r.petName}
                  petPhotoUrl={r.petPhotoUrl}
                  ownerPhotoUrl={r.ownerPhotoUrl}
                  petCategoryId={r.petCategoryId}
                  ownerUser={isYou ? user : null}
                  size="peek"
                  className="pp-hubLb__pair"
                />
                <LeaderboardPairNames
                  ownerName={r.displayName}
                  petName={r.petName}
                  showYou={isYou}
                  youLabel={t('leaderboardPage.tblYouBadge')}
                  className="pp-hubLb__pairCopy"
                />
                <span className="pp-hubLb__km">
                  {formatKm(r.kmWeek)} {t('leaderboardPage.tblKmSuffix')}
                </span>
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
