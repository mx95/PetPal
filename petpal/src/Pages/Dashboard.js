import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useGame } from '../game/GameContext';
import { usePets } from '../pets/PetsContext';

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
  } = useGame();

  const weeklyDistanceKm = 7.4;
  const streakDays = 5;

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
              return (
                <div key={m.id} className={`pp-mission ${done ? 'pp-mission--done' : ''}`}>
                  <div>
                    <div className="pp-mission__label">{m.label}</div>
                    <div className="pp-mission__xp">+{m.xp} XP</div>
                  </div>
                  {done ? (
                    <span className="pp-mission__tag">Done</span>
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
          <h2 className="pp-sectionTitle">This week</h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            Walk stats are placeholders; they can roll up per-pet when walks are logged.
          </p>
          <div className="pp-row" style={{ gap: 14, flexWrap: 'wrap' }}>
            <div className="pp-card pp-pad" style={{ flex: '1 1 220px' }}>
              <div className="pp-label">Distance</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{km(weeklyDistanceKm)}</div>
            </div>
            <div className="pp-card pp-pad" style={{ flex: '1 1 220px' }}>
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
