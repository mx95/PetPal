import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

function km(n) {
  return `${n.toFixed(1)} km`;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();

  // Placeholder stats until GPS + walks data are wired in.
  const weeklyDistanceKm = 7.4;
  const streakDays = 5;

  /** Badges tied to Traccar / live GPS (device online, fixes, live sessions). */
  const trackingAchievements = [
    { title: 'First live fix', desc: 'Receive your first GPS position from a linked device.' },
    { title: 'Always on', desc: 'Keep a device reporting for 7 consecutive days.' },
    { title: 'Rapid refresh', desc: 'Load 50 live position updates in one session.' },
  ];

  /** Badges for everyday walks (distance, habit, places) — no GPS device required. */
  const walkAchievements = [
    { title: 'First walk', desc: 'Log your first walk with PetPal.' },
    { title: '5-day streak', desc: 'Walk 5 days in a row.' },
    { title: 'Explorer', desc: 'Visit 3 new pet-friendly places on foot.' },
  ];

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="pp-badge">Signed in</div>
              <h1 className="pp-h1" style={{ marginTop: 10 }}>
                Hi{user?.displayName ? `, ${user.displayName}` : ''}!
              </h1>
              <p className="pp-subtle" style={{ marginTop: 6 }}>
                {user?.email}
              </p>
            </div>
            <div className="pp-row" style={{ gap: 10 }}>
              <Link className="pp-btn pp-btnPrimary" to="/tracking" style={{ textDecoration: 'none' }}>
                Live tracker
              </Link>
              <button className="pp-btn" onClick={signOut}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">This week</h2>
          <p className="pp-subtle" style={{ marginBottom: 12 }}>
            Walk distance and streak are placeholders for now.
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
        <div className="pp-card pp-pad" style={{ height: '100%' }}>
          <h2 className="pp-sectionTitle">Achievements</h2>
          <p className="pp-subtle" style={{ marginBottom: 14 }}>
            Two paths: <strong>live tracking</strong> (GPS device) and <strong>walks</strong> (habits
            &amp; places).
          </p>
          <div className="pp-grid" style={{ gap: 14 }}>
            <div className="pp-col-12" style={{ gridColumn: '1 / -1' }}>
              <div className="pp-achSection pp-achSection--track">
                <div className="pp-achSection__label">📡 Live tracking</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {trackingAchievements.map((a) => (
                    <div key={a.title} className="pp-card pp-pad" style={{ background: 'rgba(255,255,255,0.85)' }}>
                      <div style={{ fontWeight: 900 }}>{a.title}</div>
                      <div className="pp-subtle" style={{ marginTop: 4 }}>
                        {a.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="pp-col-12" style={{ gridColumn: '1 / -1' }}>
              <div className="pp-achSection pp-achSection--walk">
                <div className="pp-achSection__label">🚶 Walks</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {walkAchievements.map((a) => (
                    <div key={a.title} className="pp-card pp-pad" style={{ background: 'rgba(255,255,255,0.85)' }}>
                      <div style={{ fontWeight: 900 }}>{a.title}</div>
                      <div className="pp-subtle" style={{ marginTop: 4 }}>
                        {a.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Next sections to monetize</h2>
          <div className="pp-grid">
            <div className="pp-col-6">
              <div className="pp-card pp-pad">
                <div style={{ fontWeight: 900 }}>Nearby</div>
                <div className="pp-subtle" style={{ marginTop: 4 }}>
                  Pet hotels, pet stores, vets, and pet-friendly places near you.
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
                  Sniff &amp; Share — a pet-first feed for moments and walk stories.{' '}
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

