import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { saveCompanyApplication } from '../company/companyFirestore';
import LocationPicker, { defaultMapCenter } from '../company/LocationPicker';
import CompanyPlaceSearchField from '../company/CompanyPlaceSearchField';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export default function CompanyApply() {
  const { user } = useAuth();
  const { state: locationState } = useLocation();
  const { profile, profileLoading, isApprovedCompany, isPendingCompany, isRejectedCompany, firebaseReady } = useCompany();

  const [businessName, setBusinessName] = useState(
    () => (locationState && typeof locationState === 'object' && locationState.businessName) || ''
  );
  const [addressLine, setAddressLine] = useState('');
  const [publicEmail, setPublicEmail] = useState(() => (user && user.email) || '');
  const [lat, setLat] = useState(defaultMapCenter.lat);
  const [lng, setLng] = useState(defaultMapCenter.lng);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recenterSignal, setRecenterSignal] = useState(0);

  const setPos = useCallback((nextLat, nextLng) => {
    setLat(nextLat);
    setLng(nextLng);
  }, []);

  const onPlacePicked = useCallback(
    (nextLat, nextLng) => {
      setPos(nextLat, nextLng);
      setRecenterSignal((n) => n + 1);
    },
    [setPos]
  );

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
      const plat = Number(profile.lat);
      const plng = Number(profile.lng);
      if (Number.isFinite(plat) && Number.isFinite(plng)) {
        setLat(plat);
        setLng(plng);
      }
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
              in Community. With a Google Maps key we search with Google Places; otherwise search uses OpenStreetMap.
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

        <div className="pp-card pp-pad pp-companyApplyCard" style={{ marginTop: 18 }}>
          <h2 className="pp-sectionTitle">Business details &amp; pin</h2>
          <form className="pp-form pp-companyApplyForm" onSubmit={onSubmit} style={{ gap: 12 }}>
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
            <div className="pp-companyMapSection">
              <div className="pp-label">Find your business on the map</div>
              <CompanyPlaceSearchField
                onPicked={onPlacePicked}
                businessName={businessName}
                addressLine={addressLine}
              />
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
