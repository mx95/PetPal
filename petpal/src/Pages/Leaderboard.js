import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from '../pets/PetsContext';
import { useI18n } from '../i18n/I18nContext';
import { useGame } from '../game/GameContext';
import { usePublicWalk } from '../leaderboard/PublicWalkContext';
import { displayNameForUser, fetchPublicLeaderboard } from '../leaderboard/publicWalkFirestore';
import { enrichLeaderboardRow } from '../leaderboard/leaderboardRowUtils';
import { LeaderboardPairNames, LeaderboardPairVisual } from '../components/leaderboard/LeaderboardPairVisual';
import { EmptyState, PageContainer, PetIllustration, SegmentedTabs, SkeletonCard } from '../components/ui';

function formatKm(n) {
  if (n == null || Number.isNaN(n)) return '0.0';
  return (Math.round(n * 10) / 10).toFixed(1);
}

function podiumThree(rows) {
  if (!rows?.length) return [null, null, null];
  if (rows.length === 1) return [null, rows[0], null];
  if (rows.length === 2) return [rows[1], rows[0], null];
  return [rows[1], rows[0], rows[2]];
}

function rankMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

function RankBadge({ rank, compact = false }) {
  const medal = rankMedal(rank);
  const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'default';
  return (
    <span
      className={`pp-lb-rankBadge pp-lb-rankBadge--${tier} ${compact ? 'pp-lb-rankBadge--sm' : ''}`.trim()}
      aria-hidden={Boolean(medal)}
    >
      {medal || `#${rank}`}
    </span>
  );
}

function WalkLeaderboardRow({ row, rank, km, maxKm, isYou, user, t }) {
  const pct = Math.min(100, Math.round((km / maxKm) * 100));
  return (
    <li
      className={`pp-lb-row pp-lb-row--v2 ${isYou ? 'pp-lb-row--me' : ''} ${rank <= 3 ? `pp-lb-row--place-${rank}` : ''}`}
    >
      <div className="pp-lb-row__rankCol">
        <RankBadge rank={rank} compact />
      </div>
      <LeaderboardPairVisual
        ownerName={row.displayName}
        petName={row.petName}
        petPhotoUrl={row.petPhotoUrl}
        ownerPhotoUrl={row.ownerPhotoUrl}
        petCategoryId={row.petCategoryId}
        ownerUser={isYou ? user : null}
        size="row"
      />
      <div className="pp-lb-row__body">
        <LeaderboardPairNames
          ownerName={row.displayName}
          petName={row.petName}
          showYou={isYou}
          youLabel={t('leaderboardPage.tblYouBadge')}
        />
        <div className="pp-lb-row__kmLine">
          <span className="pp-lb-row__statVal">{formatKm(km)}</span>
          <span className="pp-lb-row__statUnit">{t('leaderboardPage.tblKmSuffix')}</span>
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
    </li>
  );
}

function AchievementLeaderboardRow({ row, rank, isYou, user, t }) {
  const count = Math.max(0, Math.round(Number(row.achievementCount) || 0));
  return (
    <li className={`pp-lb-achRow pp-lb-achRow--v2 ${isYou ? 'pp-lb-achRow--me' : ''} ${rank <= 3 ? `pp-lb-achRow--place-${rank}` : ''}`}>
      <div className="pp-lb-achRow__rank">
        <RankBadge rank={rank} compact />
      </div>
      <LeaderboardPairVisual
        ownerName={row.displayName}
        petName={row.petName}
        petPhotoUrl={row.petPhotoUrl}
        ownerPhotoUrl={row.ownerPhotoUrl}
        petCategoryId={row.petCategoryId}
        ownerUser={isYou ? user : null}
        size="row"
      />
      <div className="pp-lb-achRow__body">
        <LeaderboardPairNames
          ownerName={row.displayName}
          petName={row.petName}
          showYou={isYou}
          youLabel={t('leaderboardPage.tblYouBadge')}
        />
        <div className="pp-lb-achRow__metric">{t('leaderboardPage.achMetric', { count })}</div>
      </div>
    </li>
  );
}

function LbSurface({ children, className = '', hover = true }) {
  return <div className={`pp-lb-surface ${hover ? 'pp-lb-surface--hover' : ''} ${className}`.trim()}>{children}</div>;
}

export default function Leaderboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { pets } = usePets();
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

  const enrichedRows = useMemo(
    () => rows.map((row) => enrichLeaderboardRow(row, user, pets)).filter(Boolean),
    [rows, user, pets]
  );

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
    const i = enrichedRows.findIndex((r) => r.id === user.uid);
    return i >= 0 ? i + 1 : null;
  }, [enrichedRows, user?.uid]);

  const achievementRows = useMemo(() => {
    return [...enrichedRows].sort((a, b) => {
      const ax = Number(a.achievementXp) || 0;
      const bx = Number(b.achievementXp) || 0;
      if (bx !== ax) return bx - ax;
      const ac = Number(a.achievementCount) || 0;
      const bc = Number(b.achievementCount) || 0;
      if (bc !== ac) return bc - ac;
      return (Number(b.level) || 0) - (Number(a.level) || 0);
    });
  }, [enrichedRows]);

  const currentPeriodLabel = useMemo(() => periods.find((p) => p.id === period)?.label || '', [periods, period]);
  const rowsWithKm = useMemo(() => enrichedRows.filter((r) => (Number(r[key]) || 0) > 0), [enrichedRows, key]);
  const [p2, p1, p3] = podiumThree(rowsWithKm);

  const myRow = useMemo(() => enrichedRows.find((r) => r.id === user?.uid), [enrichedRows, user?.uid]);
  const myDisplayRow = useMemo(() => {
    if (myRow) return myRow;
    if (!shareOnLeaderboard || !user) return null;
    return enrichLeaderboardRow(
      {
        id: user.uid,
        displayName: displayNameForUser(user),
        petName: pets?.[0]?.name || '',
        petPhotoUrl: '',
        ownerPhotoUrl: '',
        petCategoryId: pets?.[0]?.categoryId || 'dog',
        achievementCount: 0,
        [key]: walkTotals?.[period === 'day' ? 'day' : period === 'year' ? 'year' : 'week'] || 0,
      },
      user,
      pets
    );
  }, [myRow, shareOnLeaderboard, user, pets, key, period, walkTotals]);

  const myVal = myDisplayRow ? Number(myDisplayRow[key] || 0) : 0;
  const aheadRow = yourRank != null && yourRank > 1 ? enrichedRows[yourRank - 2] : null;
  const gapKm = aheadRow && myDisplayRow != null ? Math.max(0, (Number(aheadRow[key]) || 0) - myVal) : null;

  const maxWalkKm = useMemo(() => {
    if (!enrichedRows.length) return 1;
    return Math.max(1, ...enrichedRows.map((r) => Number(r[key]) || 0));
  }, [enrichedRows, key]);

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
    <PageContainer className="animate-fade-up pp-lb-page--social">
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/80 p-5 shadow-lift backdrop-blur sm:p-8">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-petpal-soft blur-3xl" aria-hidden />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_180px] lg:items-center">
            <div>
              <span className="mb-3 inline-flex rounded-full bg-petpal-soft px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-petpal-lilac">
                {t('leaderboardPage.rankingsHeading')}
              </span>
              <h1 className="text-3xl font-black tracking-[-0.05em] text-petpal-ink sm:text-5xl">{t('leaderboardPage.heroTitle')}</h1>
            </div>
            <PetIllustration variant="trophy" className="mx-auto h-36 w-36 sm:h-44 sm:w-44" />
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
          <div className="grid gap-3 md:grid-cols-3">
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

        {shareOnLeaderboard && myDisplayRow && yourRank != null ? (
          <LbSurface hover={false} className="pp-lb-meCard pp-lb-meCard--social">
            <span className="pp-lb-meCard__badge">{t('leaderboardPage.yourPositionBadge')}</span>
            <div className="pp-lb-meCard__heroRank">
              {rankMedal(yourRank) ? (
                <span className="pp-lb-meCard__medal" aria-hidden>
                  {rankMedal(yourRank)}
                </span>
              ) : null}
              <span className="pp-lb-meCard__rank">#{yourRank}</span>
            </div>
            <div className="pp-lb-meCard__social">
              <LeaderboardPairVisual
                ownerName={myDisplayRow.displayName}
                petName={myDisplayRow.petName}
                petPhotoUrl={myDisplayRow.petPhotoUrl}
                ownerPhotoUrl={myDisplayRow.ownerPhotoUrl}
                petCategoryId={myDisplayRow.petCategoryId}
                ownerUser={user}
                size="hero"
              />
              <LeaderboardPairNames ownerName={myDisplayRow.displayName} petName={myDisplayRow.petName} />
            </div>
            <div className="pp-lb-meCard__km">
              {formatKm(myVal)} <span>{t('leaderboardPage.tblKmSuffix')} · {currentPeriodLabel}</span>
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

        {showPodium ? (
          <section className="pp-lb-section">
            <h2 className="pp-lb-sectionTitle">{t('leaderboardPage.rankingsHeading')}</h2>
            <div className="pp-lb-podium pp-lb-podium--social">
              {[p2, p1, p3].map((r, idx) => {
                const rankNums = [2, 1, 3];
                const heights = ['pp-lb-podium__block--silver', 'pp-lb-podium__block--gold', 'pp-lb-podium__block--bronze'];
                const rank = rankNums[idx];
                if (!r) {
                  return (
                    <div key={`empty-${idx}`} className={`pp-lb-podium__block ${heights[idx]} pp-lb-podium__block--empty`}>
                      <RankBadge rank={rank} />
                      <span className="pp-lb-podium__empty">—</span>
                    </div>
                  );
                }
                const isYou = r.id === user?.uid;
                return (
                  <div key={r.id} className={`pp-lb-podium__block ${heights[idx]} ${isYou ? 'pp-lb-podium__block--me' : ''}`}>
                    <RankBadge rank={rank} />
                    <LeaderboardPairVisual
                      ownerName={r.displayName}
                      petName={r.petName}
                      petPhotoUrl={r.petPhotoUrl}
                      ownerPhotoUrl={r.ownerPhotoUrl}
                      petCategoryId={r.petCategoryId}
                      ownerUser={isYou ? user : null}
                      size="podium"
                    />
                    <LeaderboardPairNames
                      ownerName={r.displayName}
                      petName={r.petName}
                      showYou={isYou}
                      youLabel={t('leaderboardPage.tblYouBadge')}
                    />
                    <span className="pp-lb-podium__km">
                      {formatKm(r[key])} {t('leaderboardPage.tblKmSuffix')}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && enrichedRows.length > 0 ? (
          <section className="pp-lb-section">
            <h2 className="pp-lb-sectionTitle">{t('leaderboardPage.listHeadingWalk', { period: currentPeriodLabel })}</h2>
            <LbSurface hover={false} className="pp-lb-listWrap pp-lb-listWrap--social">
              <ul className="pp-lb-rows pp-lb-rows--social">
                {enrichedRows.map((r, i) => {
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
                      user={user}
                      t={t}
                    />
                  );
                })}
              </ul>
            </LbSurface>
          </section>
        ) : null}

        <section className="pp-lb-section">
          <LbSurface hover={false} className="pp-lb-ach pp-lb-ach--social">
            <h2 className="pp-lb-h2">{t('leaderboardPage.achTitle')}</h2>
            {!loading && !loadError && achievementRows.length === 0 && isFirestoreEnabled ? (
              <p className="pp-lb-muted">{t('leaderboardPage.achEmpty')}</p>
            ) : null}
            <ul className="pp-lb-achRows pp-lb-achRows--social">
              {achievementRows.map((r, i) => {
                const isYou = r.id === user?.uid;
                return (
                  <AchievementLeaderboardRow key={`ach-${r.id}`} row={r} rank={i + 1} isYou={isYou} user={user} t={t} />
                );
              })}
            </ul>
          </LbSurface>
        </section>
      </div>
    </PageContainer>
  );
}
