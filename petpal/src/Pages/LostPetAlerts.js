import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PetAvatar from '../components/PetAvatar';
import { useLostPet } from '../lostPet/LostPetContext';
import { usePets } from '../pets/PetsContext';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function LostPetAlerts() {
  const { pets, getCategory } = usePets();
  const { premiumUnlocked, setPremium, activeListings, publishAlert, resolveAlert } = useLostPet();
  const [petId, setPetId] = useState('');
  const [description, setDescription] = useState('');
  const [lastSeenText, setLastSeenText] = useState('');
  const [lastSeenLat, setLastSeenLat] = useState('');
  const [lastSeenLng, setLastSeenLng] = useState('');
  const [reward, setReward] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const petSelectId = useId();

  const hasPets = pets.length > 0;

  const sortedPets = useMemo(() => [...pets].sort((a, b) => a.name.localeCompare(b.name)), [pets]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!petId) {
      setFormError('Select a pet.');
      return;
    }
    setSubmitting(true);
    try {
      const r = publishAlert({
        petId,
        description,
        lastSeenText,
        lastSeenLat: lastSeenLat.trim(),
        lastSeenLng: lastSeenLng.trim(),
        reward,
        contactPhone,
      });
      if (!r.ok) {
        if (r.error === 'description') setFormError('Add a short description (appearance, collar, name response).');
        else if (r.error === 'lastSeen') setFormError('Add where and when the pet was last seen.');
        else setFormError('Could not create alert. Try again.');
        return;
      }
      setDescription('');
      setLastSeenText('');
      setLastSeenLat('');
      setLastSeenLng('');
      setReward('');
      setContactPhone('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge pp-badge--premium">Premium</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Lost pet alerts
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 640 }}>
              Urgent, structured posts to help get your pet home: last known area, how to contact you, and an optional
              reward. Data stays on <strong>this device</strong> for now; cloud sync and wider sharing can be added
              later. Add profile photos to pets in{' '}
              <Link className="pp-link" to="/pets" style={{ display: 'inline', padding: 0 }}>
                My pets
              </Link>
              .
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-lostPetPremiumCta" style={{ borderColor: 'rgba(180, 120, 32, 0.35)' }}>
          <h2 className="pp-sectionTitle">What you get (preview)</h2>
          <ul className="pp-subtle" style={{ margin: '0 0 12px 18px', lineHeight: 1.5 }}>
            <li>One-tap call from your public phone number (shown on the alert only here — be mindful of privacy)</li>
            <li>Last seen / area text plus optional map coordinates</li>
            <li>Reward line for finders (optional)</li>
          </ul>
          {!premiumUnlocked ? (
            <p style={{ margin: 0 }}>
              <button type="button" className="pp-btn pp-btnPremium" onClick={() => setPremium(true)}>
                Enable Premium (preview)
              </button>
              <span className="pp-subtle" style={{ marginLeft: 10, fontSize: 12 }}>
                No payment in this build — for testing the experience only.
              </span>
            </p>
          ) : (
            <p className="pp-subtle" style={{ margin: 0, fontSize: 13 }}>
              Premium preview is on. You can create and manage alerts below, or{' '}
              <button type="button" className="pp-link" style={{ display: 'inline', padding: 0, border: 0, background: 'none', font: 'inherit' }} onClick={() => setPremium(false)}>
                turn off preview
              </button>
              .
            </p>
          )}
        </div>
      </div>

      {premiumUnlocked && hasPets ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad" style={{ maxWidth: 720 }}>
            <h2 className="pp-sectionTitle">Create alert</h2>
            <form className="pp-form" onSubmit={onSubmit} style={{ gap: 12 }}>
              <div>
                <div className="pp-label" id={`${petSelectId}-label`}>
                  Pet
                </div>
                <select
                  id={petSelectId}
                  className="pp-input"
                  aria-labelledby={`${petSelectId}-label`}
                  value={petId}
                  onChange={(e) => setPetId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {sortedPets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getCategory(p).emoji} {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="pp-label">Description (what helps people recognize your pet?)</div>
                <textarea
                  className="pp-input"
                  style={{ minHeight: 100, resize: 'vertical' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  maxLength={2000}
                  placeholder="Breed, size, collar, behaviour…"
                />
              </div>
              <div>
                <div className="pp-label">Last place / time seen</div>
                <textarea
                  className="pp-input"
                  style={{ minHeight: 72, resize: 'vertical' }}
                  value={lastSeenText}
                  onChange={(e) => setLastSeenText(e.target.value)}
                  required
                  maxLength={1000}
                  placeholder="e.g. This morning, near the north gate of the park on …"
                />
              </div>
              <div className="pp-row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 140px' }}>
                  <div className="pp-label">Latitude (optional, maps link)</div>
                  <input
                    className="pp-input"
                    value={lastSeenLat}
                    onChange={(e) => setLastSeenLat(e.target.value)}
                    placeholder="e.g. 35.173"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <div className="pp-label">Longitude (optional)</div>
                  <input
                    className="pp-input"
                    value={lastSeenLng}
                    onChange={(e) => setLastSeenLng(e.target.value)}
                    placeholder="e.g. 33.364"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <div className="pp-label">Reward (optional)</div>
                <input
                  className="pp-input"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. €50 thank-you for safe return"
                />
              </div>
              <div>
                <div className="pp-label">Contact phone (optional — public on this device)</div>
                <input
                  className="pp-input"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  maxLength={40}
                  placeholder="+357 …"
                />
                <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                  Only add a number you are comfortable sharing. Shown on your alert for quick calls.
                </p>
              </div>
              {formError ? <div className="pp-error">{formError}</div> : null}
              <div>
                <button type="submit" className="pp-btn pp-btnPrimary" disabled={submitting || !petId}>
                  {submitting ? 'Saving…' : 'Publish alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {premiumUnlocked && !hasPets ? (
        <div className="pp-col-12">
          <p className="pp-subtle">
            <Link to="/pets">Add a pet first</Link> with a name and (recommended) a profile photo.
          </p>
        </div>
      ) : null}

      {!premiumUnlocked ? null : (
        <div className="pp-col-12">
          <h2 className="pp-sectionTitle" style={{ marginBottom: 12 }}>
            Your active alerts
          </h2>
          {activeListings.length === 0 ? (
            <p className="pp-subtle">No active alerts. Create one when you need it — we hope you never do.</p>
          ) : (
            <ul className="pp-lostPetList" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeListings.map((L) => (
                <li key={L.id} className="pp-card pp-pad" style={{ borderColor: 'rgba(180, 50, 50, 0.25)' }}>
                  <div className="pp-row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <PetAvatar pet={{ categoryId: L.categoryId, photoDataUrl: L.photoDataUrl }} size={96} className="pp-petAvatar--lg" />
                    <div style={{ flex: '1 1 240px' }}>
                      <div className="pp-h1" style={{ fontSize: 20, margin: '0 0 6px' }}>
                        {L.petName} <span className="pp-subtle" style={{ fontSize: 13, fontWeight: 600 }}>lost</span>
                      </div>
                      <p className="pp-subtle" style={{ margin: '0 0 8px', fontSize: 12 }}>{formatWhen(L.createdAt)}</p>
                      <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>{L.description}</p>
                      <p style={{ margin: '0 0 8px' }}>
                        <strong>Last seen:</strong> {L.lastSeenText}
                      </p>
                      {L.lastSeenLat != null && L.lastSeenLng != null ? (
                        <p style={{ margin: '0 0 8px' }}>
                          <a className="pp-link" href={mapsLink(L.lastSeenLat, L.lastSeenLng)} target="_blank" rel="noopener noreferrer">
                            Open map for coordinates
                          </a>
                        </p>
                      ) : null}
                      {L.reward ? (
                        <p style={{ margin: '0 0 8px' }}>
                          <strong>Reward:</strong> {L.reward}
                        </p>
                      ) : null}
                      {L.contactPhone ? (
                        <p style={{ margin: 0 }}>
                          <a className="pp-btn pp-btnPrimary" style={{ display: 'inline-block', textDecoration: 'none' }} href={`tel:${L.contactPhone.replace(/\s/g, '')}`}>
                            Call {L.contactPhone}
                          </a>
                        </p>
                      ) : (
                        <p className="pp-subtle" style={{ margin: 0, fontSize: 12 }}>No phone on this alert</p>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="pp-btn" onClick={() => resolveAlert(L.id)}>
                      Mark as found
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
