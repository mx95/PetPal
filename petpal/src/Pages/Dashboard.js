import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useGame } from '../game/GameContext';
import { usePets } from '../pets/PetsContext';
import { MAX_PHOTOS_PER_WALK_SESSION } from '../walk/walkPhotos';
import { walkStreakDays } from '../walk/walkStats';

function km(n) {
  return `${n.toFixed(1)} km`;
}

function ProgressMicro({ value01 }) {
  const pct = Math.round(Math.min(1, Math.max(0, value01)) * 100);
  return (
    <div className="pp-microBar" aria-label={`Progress ${pct}%`}>
      <div className="pp-microBar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { pets, getCategory } = usePets();
  const {
    ownerXp,
    level,
    levelXp,
    nextMax,
    DAILY_MISSIONS,
    isDailyDone,
    completeDaily,
    petProgressPercent,
    trackingAchievementDefs,
    walkAchievementDefs,
    walkLog,
    walkTotals,
    addWalkKm,
    latestWalk,
    addPhotosToLatestWalk,
    removePhotoFromLatestWalk,
  } = useGame();

  const walkFieldId = useId();
  const walkFilesId = useId();
  const walkFilesRef = useRef(null);
  const morePhotosId = useId();
  const [walkInput, setWalkInput] = useState('');
  const [walkLogBusy, setWalkLogBusy] = useState(false);
  const [walkPhotoMsg, setWalkPhotoMsg] = useState('');

  const streakDays = walkStreakDays(walkLog);
  const onLogWalk = async (e) => {
    e.preventDefault();
    setWalkPhotoMsg('');
    const n = parseFloat(String(walkInput).replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) {
      setWalkPhotoMsg('Enter a distance greater than 0 to log a walk.');
      return;
    }
    setWalkLogBusy(true);
    try {
      const files = walkFilesRef.current?.files;
      const ok = await addWalkKm(n, files);
      if (ok) {
        setWalkInput('');
        if (walkFilesRef.current) walkFilesRef.current.value = '';
        setWalkPhotoMsg(files && files.length ? 'Walk logged with photos.' : 'Walk logged.');
      }
    } finally {
      setWalkLogBusy(false);
    }
  };

  const onAddMorePhotos = async (e) => {
    const { files } = e.target;
    setWalkPhotoMsg('');
    if (!files || !files.length) return;
    setWalkLogBusy(true);
    try {
      const r = await addPhotosToLatestWalk(files);
      if (r.ok) {
        setWalkPhotoMsg(r.added ? `Added ${r.added} photo(s).` : '');
      } else if (r.reason === 'max_photos') {
        setWalkPhotoMsg(`You can have up to ${MAX_PHOTOS_PER_WALK_SESSION} photos on this walk.`);
      } else if (r.reason === 'no_session') {
        setWalkPhotoMsg('Log a walk with distance first, then you can add photos to it.');
      } else {
        setWalkPhotoMsg('Could not add photos. Try a smaller image or fewer files.');
      }
    } finally {
      setWalkLogBusy(false);
      e.target.value = '';
    }
  };

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="pp-badge">Signed in</div>
              <h1 className="pp-h1" style={{ marginTop: 10 }}>
                Hi{user?.displayName ? `, ${user.displayName}` : ''}!
              </h1>
              <p className="pp-subtle" style={{ marginTop: 6 }}>
                {user?.email}
              </p>
            </div>
            <div className="pp-row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Link className="pp-btn pp-btnPrimary" to="/pets" style={{ textDecoration: 'none' }}>
                My pets
              </Link>
              <Link className="pp-btn" to="/leaderboard" style={{ textDecoration: 'none' }}>
                Leaderboard
              </Link>
              <Link className="pp-btn" to="/tracking" style={{ textDecoration: 'none' }}>
                Live tracker
              </Link>
              <button className="pp-btn" onClick={signOut}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ borderColor: 'rgba(91, 55, 255, 0.25)' }}>
          <h2 className="pp-sectionTitle">Caregiver level</h2>
          <p className="pp-subtle" style={{ marginBottom: 10 }}>
            Tiny daily tasks add XP. Level up over time — light progression, not a full game grind.
          </p>
          <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em' }}>Level {level}</div>
            <div className="pp-subtle" style={{ fontWeight: 700 }}>
              {ownerXp} XP
            </div>
          </div>
          <div className="pp-levelBar" style={{ marginTop: 10 }}>
            <div
              className="pp-levelBar__fill"
              style={{ width: `${(levelXp / nextMax) * 100}%` }}
            />
          </div>
          <p className="pp-subtle" style={{ marginTop: 8, fontSize: 12 }}>
            {levelXp} / {nextMax} XP to the next level
          </p>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Today&apos;s mini-goals</h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            Complete once per day. Small XP for your caregiver level.
          </p>
          <div className="pp-missionGrid">
            {DAILY_MISSIONS.map((m) => {
              const done = isDailyDone(m.id);
              const needKm = m.minWalkKmToday;
              const dayKm = walkTotals.day;
              const walkMet = needKm == null || dayKm >= needKm;
              return (
                <div key={m.id} className={`pp-mission ${done ? 'pp-mission--done' : ''}`}>
                  <div>
                    <div className="pp-mission__label">{m.label}</div>
                    <div className="pp-mission__xp">+{m.xp} XP</div>
                    {m.description ? <div className="pp-mission__hint" style={{ marginTop: 6 }}>{m.description}</div> : null}
                    {needKm != null && !done ? (
                      <div className="pp-mission__hint" style={{ marginTop: 6, fontWeight: 700, color: '#101828' }}>
                        Today: {dayKm.toFixed(1)} / {needKm} km
                        {!walkMet ? (
                          <span className="pp-subtle" style={{ fontWeight: 600, display: 'block', marginTop: 4 }}>
                            Log distance in the card below — amounts add up for the day.
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {done ? (
                    <span className="pp-mission__tag">Done</span>
                  ) : needKm != null ? (
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      disabled={!walkMet}
                      onClick={() => completeDaily(m.id)}
                    >
                      {walkMet ? 'Claim reward' : 'Need 5 km'}
                    </button>
                  ) : (
                    <button type="button" className="pp-btn pp-btnPrimary" onClick={() => completeDaily(m.id)}>
                      Got it
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Walks &amp; distance</h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            Log how far you walked with your pet (total for the day). Used for the weekly view and the optional public
            leaderboard. You can attach photos to your <strong>latest</strong> log — stored on this device for now.
          </p>
          <form onSubmit={onLogWalk} className="pp-form" style={{ marginBottom: 14 }}>
            <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label htmlFor={walkFieldId} className="pp-label">
                  Add to today (km)
                </label>
                <input
                  id={walkFieldId}
                  className="pp-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={walkInput}
                  onChange={(e) => setWalkInput(e.target.value)}
                  style={{ maxWidth: 120 }}
                />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label htmlFor={walkFilesId} className="pp-label">
                  Photos (optional)
                </label>
                <input
                  id={walkFilesId}
                  ref={walkFilesRef}
                  className="pp-input"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ fontSize: 14 }}
                />
                <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                  Up to 8 per batch, resized to save space. Same walk can be extended below.
                </p>
              </div>
              <button type="submit" className="pp-btn pp-btnPrimary" disabled={walkLogBusy}>
                {walkLogBusy ? 'Saving…' : 'Log walk'}
              </button>
            </div>
            {walkPhotoMsg ? (
              <p
                className="pp-subtle"
                style={{
                  marginTop: 10,
                  color: walkPhotoMsg.startsWith('Added') || walkPhotoMsg.startsWith('Walk logged') ? '#027a48' : '#b42318',
                  fontSize: 13,
                }}
              >
                {walkPhotoMsg}
              </p>
            ) : null}
          </form>

          {latestWalk ? (
            <div
              className="pp-card pp-pad"
              style={{
                marginBottom: 14,
                borderColor: 'rgba(18, 183, 106, 0.35)',
                background: 'rgba(236, 253, 243, 0.5)',
              }}
            >
              <h3 className="pp-sectionTitle" style={{ fontSize: 16, marginTop: 0 }}>
                Latest walk
              </h3>
              <p className="pp-subtle" style={{ marginBottom: 8 }}>
                <strong>{km(latestWalk.km)}</strong> ·{' '}
                {new Date(latestWalk.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              {latestWalk.photos && latestWalk.photos.length > 0 ? (
                <div className="pp-walkPhotoGrid">
                  {latestWalk.photos.map((src, i) => (
                    <div key={`${latestWalk.id}-p${i}`} className="pp-walkPhotoTile">
                      <img src={src} alt="" className="pp-walkPhotoTile__img" />
                      <button
                        type="button"
                        className="pp-walkPhotoTile__remove"
                        onClick={() => removePhotoFromLatestWalk(i)}
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pp-subtle" style={{ fontSize: 14 }}>No photos on this log yet.</p>
              )}
              <p className="pp-subtle" style={{ fontSize: 12, marginTop: 8, marginBottom: 6 }}>
                Photos: {latestWalk.photos?.length || 0} / {MAX_PHOTOS_PER_WALK_SESSION}
              </p>
              <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="pp-btn" htmlFor={morePhotosId} style={{ margin: 0, cursor: 'pointer' }}>
                  Add more photos
                </label>
                <input
                  id={morePhotosId}
                  type="file"
                  accept="image/*"
                  multiple
                  className="pp-visuallyHidden"
                  onChange={onAddMorePhotos}
                  disabled={walkLogBusy}
                />
              </div>
            </div>
          ) : null}

          <div className="pp-row" style={{ gap: 14, flexWrap: 'wrap' }}>
            <div className="pp-card pp-pad" style={{ flex: '1 1 200px' }}>
              <div className="pp-label">Today</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{km(walkTotals.day)}</div>
            </div>
            <div className="pp-card pp-pad" style={{ flex: '1 1 200px' }}>
              <div className="pp-label">This week</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{km(walkTotals.week)}</div>
            </div>
            <div className="pp-card pp-pad" style={{ flex: '1 1 200px' }}>
              <div className="pp-label">This year</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{km(walkTotals.year)}</div>
            </div>
            <div className="pp-card pp-pad" style={{ flex: '1 1 200px' }}>
              <div className="pp-label">Streak</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{streakDays} days</div>
            </div>
          </div>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Your pack</h2>
          {pets.length === 0 ? (
            <p className="pp-subtle">
              <Link className="pp-link" to="/pets" style={{ padding: 0, display: 'inline' }}>
                Add your first pet
              </Link>{' '}
              to unlock per-pet achievements and community tags.
            </p>
          ) : (
            <ul className="pp-packList">
              {pets.map((p) => (
                <li key={p.id} className="pp-packList__row">
                  <span className="pp-packList__emoji">{getCategory(p).emoji}</span>
                  <div>
                    <div className="pp-packList__name">{p.name}</div>
                    <div className="pp-packList__sub">{getCategory(p).label}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {pets.length > 0
        ? pets.map((p) => (
            <div className="pp-col-12" key={p.id}>
              <div className="pp-card pp-pad">
                <h2 className="pp-sectionTitle">
                  {getCategory(p).emoji} {p.name} — achievements
                </h2>
                <p className="pp-subtle" style={{ marginBottom: 12 }}>
                  Separate tracks: live GPS vs everyday walks. Progress fills as you use PetPal.
                </p>
                <div className="pp-petAchGrid">
                  <div className="pp-achSection pp-achSection--track">
                    <div className="pp-achSection__label">📡 Live tracking</div>
                    {trackingAchievementDefs.map((a) => (
                      <div key={a.key} className="pp-achLine">
                        <div>
                          <div style={{ fontWeight: 800 }}>{a.label}</div>
                          <div className="pp-subtle" style={{ marginTop: 2, fontSize: 13 }}>
                            {a.desc}
                          </div>
                        </div>
                        <ProgressMicro value01={petProgressPercent(p.id, 'track', a.key)} />
                      </div>
                    ))}
                  </div>
                  <div className="pp-achSection pp-achSection--walk">
                    <div className="pp-achSection__label">🚶 Walks</div>
                    {walkAchievementDefs.map((a) => (
                      <div key={a.key} className="pp-achLine">
                        <div>
                          <div style={{ fontWeight: 800 }}>{a.label}</div>
                          <div className="pp-subtle" style={{ marginTop: 2, fontSize: 13 }}>
                            {a.desc}
                          </div>
                        </div>
                        <ProgressMicro value01={petProgressPercent(p.id, 'walk', a.key)} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        : null}

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Next sections to monetize</h2>
          <div className="pp-grid">
            <div className="pp-col-6">
              <div className="pp-card pp-pad">
                <div style={{ fontWeight: 900 }}>Nearby</div>
                <div className="pp-subtle" style={{ marginTop: 4 }}>
                  Pet shops, hotels, vets, parks, and more on a map.{' '}
                  <Link className="pp-link" to="/nearby" style={{ display: 'inline', padding: 0 }}>
                    Open nearby →
                  </Link>
                </div>
              </div>
            </div>
            <div className="pp-col-6">
              <div className="pp-card pp-pad">
                <div style={{ fontWeight: 900 }}>Shop</div>
                <div className="pp-subtle" style={{ marginTop: 4 }}>
                  Curated products, affiliate links, or your own inventory.
                </div>
              </div>
            </div>
            <div className="pp-col-6">
              <div className="pp-card pp-pad">
                <div style={{ fontWeight: 900 }}>Community</div>
                <div className="pp-subtle" style={{ marginTop: 4 }}>
                  Sniff &amp; Share — post with you + one or more pets.{' '}
                  <Link className="pp-link" to="/community" style={{ display: 'inline', padding: 0 }}>
                    Open community →
                  </Link>
                </div>
              </div>
            </div>
            <div className="pp-col-6">
              <div className="pp-card pp-pad">
                <div style={{ fontWeight: 900 }}>Premium</div>
                <div className="pp-subtle" style={{ marginTop: 4 }}>
                  Live tracking, geofences, and family sharing via subscription.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
