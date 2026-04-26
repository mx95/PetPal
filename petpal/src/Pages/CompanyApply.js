import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { saveCompanyApplication } from '../company/companyFirestore';
import LocationPicker, { defaultMapCenter } from '../company/LocationPicker';
import { searchOsmPlaces } from '../company/placeSearch';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export default function CompanyApply() {
  const { user } = useAuth();
  const { state } = useLocation();
  const { profile, profileLoading, isApprovedCompany, isPendingCompany, isRejectedCompany, firebaseReady } = useCompany();

  const [businessName, setBusinessName] = useState(() => (state && state.businessName) || '');
  const [addressLine, setAddressLine] = useState('');
  const [publicEmail, setPublicEmail] = useState(() => (user && user.email) || '');
  const [lat, setLat] = useState(defaultMapCenter.lat);
  const [lng, setLng] = useState(defaultMapCenter.lng);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [mapResults, setMapResults] = useState([]);
  const [mapSearchBusy, setMapSearchBusy] = useState(false);
  const [mapSearchErr, setMapSearchErr] = useState('');
  const [recenterSignal, setRecenterSignal] = useState(0);

  const setPos = useCallback((nextLat, nextLng) => {
    setLat(nextLat);
    setLng(nextLng);
  }, []);

  const runMapSearch = useCallback(async () => {
    setMapSearchErr('');
    const t = mapSearch.trim();
    if (t.length < 2) {
      setMapSearchErr('Type at least 2 characters.');
      return;
    }
    setMapSearchBusy(true);
    try {
      const rows = await searchOsmPlaces(t);
      setMapResults(rows);
      if (rows.length === 0) {
        setMapSearchErr('No results. Try a shorter name, add a city, or place the pin manually.');
      }
    } catch (e) {
      setMapSearchErr(e?.message || 'Search failed. Try again or set the pin manually.');
      setMapResults([]);
    } finally {
      setMapSearchBusy(false);
    }
  }, [mapSearch]);

  const selectMapResult = useCallback(
    (p) => {
      setPos(p.lat, p.lng);
      setRecenterSignal((n) => n + 1);
      setMapResults([]);
      setMapSearchErr('');
    },
    [setPos]
  );

  const fillSearchFromForm = useCallback(() => {
    const s = [businessName, addressLine].filter(Boolean).join(' ').trim();
    if (s) setMapSearch(s);
  }, [businessName, addressLine]);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (g) => setPos(g.coords.latitude, g.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }, [setPos]);

  useEffect(() => {
    if (profile && profile.businessName) setBusinessName(profile.businessName);
    if (profile && profile.addressLine) setAddressLine(profile.addressLine);
    if (profile && profile.publicEmail) setPublicEmail(profile.publicEmail);
    if (profile && profile.lat != null && profile.lng != null) {
      setLat(profile.lat);
      setLng(profile.lng);
    }
  }, [profile]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!user?.uid) {
      setError('You must be signed in.');
      return;
    }
    if (!businessName.trim()) {
      setError('Enter a business or venue name.');
      return;
    }
    setSubmitting(true);
    try {
      await saveCompanyApplication(user.uid, {
        businessName: businessName.trim(),
        addressLine,
        publicEmail: publicEmail.trim(),
        lat,
        lng,
      });
    } catch (err) {
      const c = err?.code || err?.message || '';
      if (c.includes('permission') || c.includes('PERMISSION')) {
        setError('Permission denied. Check Firestore security rules and that you are signed in.');
      } else if (c === 'firebase_unconfigured' || err?.message === 'firebase_unconfigured') {
        setError('Firebase is not configured. Add REACT_APP_* keys in .env.local and deploy Firestore rules.');
      } else {
        setError(err?.message || 'Could not save application.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-subtle">Loading business profile…</p>
        </div>
      </div>
    );
  }

  if (isApprovedCompany && profile) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12" style={{ maxWidth: 640 }}>
          <div className="pp-badge">Business</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            {profile.businessName} is live
          </h1>
          <p className="pp-subtle" style={{ marginTop: 8 }}>
            Your listing is approved. You can post business updates in Community — including paid boosted posts (checkout
            coming soon; your boost request is stored on the post for now).
          </p>
          <p className="pp-subtle" style={{ marginTop: 6 }}>
            <a className="pp-link" href={mapsLink(profile.lat, profile.lng)} target="_blank" rel="noopener noreferrer">
              Open your pin in Google Maps
            </a>
          </p>
          <p style={{ marginTop: 20 }}>
            <Link className="pp-btn pp-btnPrimary" to="/community">
              Go to Community
            </Link>
            <Link className="pp-link" to="/dashboard" style={{ marginLeft: 12 }}>
              Dashboard
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (isPendingCompany && profile) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12" style={{ maxWidth: 640 }}>
          <div className="pp-badge">Business</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            Awaiting confirmation
          </h1>
          <p className="pp-subtle" style={{ marginTop: 8 }}>
            <strong>{profile.businessName}</strong> is waiting for a PetPal admin to verify your map pin and business
            details. You can still use the app as a pet owner; business posting unlocks after approval.
          </p>
          <p>
            <Link className="pp-link" to="/community">
              Community
            </Link>
            <span className="pp-subtle" style={{ margin: '0 8px' }}>
              ·
            </span>
            <Link className="pp-link" to="/dashboard">
              Dashboard
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12" style={{ maxWidth: 640 }}>
          <div className="pp-error">Firebase is not configured. Add your web app keys to the environment, then try again.</div>
          <p className="pp-subtle" style={{ marginTop: 8 }}>
            <Link className="pp-link" to="/dashboard">
              ← Back
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12" style={{ maxWidth: 720 }}>
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge">Business</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Register on the map
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 560 }}>
              Place your real-world location. An admin must approve your listing before you can run paid boosted posts
              in Community. OpenStreetMap is used here so no Google Maps key is required for this step.
            </p>
            {isRejectedCompany && profile?.rejectionNote ? (
              <p className="pp-error" style={{ marginTop: 10 }}>
                Previous request was not approved: {profile.rejectionNote}
              </p>
            ) : null}
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>

        <div className="pp-card pp-pad" style={{ marginTop: 18 }}>
          <h2 className="pp-sectionTitle">Business details &amp; pin</h2>
          <form className="pp-form" onSubmit={onSubmit} style={{ gap: 12 }}>
            <div>
              <div className="pp-label">Business or venue name</div>
              <input
                className="pp-input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                maxLength={120}
                placeholder="e.g. Happy Paws Daycare"
              />
            </div>
            <div>
              <div className="pp-label">Address (optional, shown in admin review)</div>
              <input
                className="pp-input"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                maxLength={200}
                placeholder="Street, city"
              />
            </div>
            <div>
              <div className="pp-label">Contact email (optional)</div>
              <input
                className="pp-input"
                type="email"
                value={publicEmail}
                onChange={(e) => setPublicEmail(e.target.value)}
                placeholder="hello@example.com"
              />
            </div>
            <div>
              <div className="pp-label">Find your business on the map</div>
              <p className="pp-subtle" style={{ fontSize: 12, marginBottom: 8 }}>
                Search by name, street, or area (OpenStreetMap data via Photon; not every business is listed). Then adjust
                the pin on the map if needed.
              </p>
              <div className="pp-companyMapSearch">
                <div className="pp-companyMapSearch__row">
                  <input
                    className="pp-input"
                    value={mapSearch}
                    onChange={(e) => setMapSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        runMapSearch();
                      }
                    }}
                    placeholder="e.g. Pet shop, Makarios Limassol…"
                    aria-label="Search for your business on the map"
                  />
                  <button type="button" className="pp-btn" disabled={mapSearchBusy} onClick={runMapSearch}>
                    {mapSearchBusy ? '…' : 'Search'}
                  </button>
                </div>
                <button type="button" className="pp-link" style={{ display: 'inline', padding: '4px 0', fontSize: 13 }} onClick={fillSearchFromForm}>
                  Fill search from name and address above
                </button>
                {mapSearchErr ? (
                  <p className="pp-error" style={{ marginTop: 8, marginBottom: 0 }}>
                    {mapSearchErr}
                  </p>
                ) : null}
                {mapResults.length > 0 ? (
                  <ul className="pp-companyMapSearch__results" role="listbox" aria-label="Map search results">
                    {mapResults.map((p, i) => (
                      <li key={`${p.lat}-${p.lng}-${i}`}>
                        <button type="button" className="pp-companyMapSearch__resultBtn" onClick={() => selectMapResult(p)}>
                          <span className="pp-companyMapSearch__resultLabel">{p.label}</span>
                          {p.type ? <span className="pp-companyMapSearch__resultType">{p.type}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="pp-label" style={{ marginTop: 14 }}>Pin position</div>
              <LocationPicker lat={lat} lng={lng} onChange={setPos} recenterSignal={recenterSignal} />
              <p className="pp-subtle" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                <a className="pp-link" style={{ display: 'inline' }} href={mapsLink(lat, lng)} target="_blank" rel="noopener noreferrer">
                  Preview in Google Maps
                </a>{' '}
                (opens new tab)
              </p>
            </div>
            {error ? <div className="pp-error">{error}</div> : null}
            <div>
              <button type="submit" className="pp-btn pp-btnPrimary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
