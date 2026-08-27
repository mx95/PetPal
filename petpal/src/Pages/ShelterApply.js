import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import LocationPicker, { defaultMapCenter } from '../company/LocationPicker';
import CompanyPlaceSearchField from '../company/CompanyPlaceSearchField';
import { uploadScopedPhoto } from '../media/scopedPhotoStorage';
import { useI18n } from '../i18n/I18nContext';
import { saveShelterApplication } from '../shelter/shelterFirestore';
import { validateShelterApplication, CYPRUS_CITIES } from '../shelter/shelterUtils';

export default function ShelterApply() {
  const { user } = useAuth();
  const { shelterProfile, shelterProfileLoading, firebaseReady } = useCompany();
  const { t } = useI18n();
  const [shelterName, setShelterName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [registrationDetails, setRegistrationDetails] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [publicEmail, setPublicEmail] = useState(() => user?.email || '');
  const [addressLine, setAddressLine] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Nicosia');
  const [lat, setLat] = useState(defaultMapCenter.lat);
  const [lng, setLng] = useState(defaultMapCenter.lng);
  const [logoUrl, setLogoUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recenterSignal, setRecenterSignal] = useState(0);

  const setPos = useCallback((nextLat, nextLng) => {
    setLat(nextLat);
    setLng(nextLng);
    setRecenterSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (g) => setPos(g.coords.latitude, g.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }, [setPos]);

  async function uploadImage(file, kind) {
    if (!user?.uid || !file) return;
    const uploaded = await uploadScopedPhoto({
      uid: user.uid,
      scope: kind === 'logo' ? 'shelterLogos' : 'shelterCovers',
      entityId: kind,
      file,
    });
    if (!uploaded) return;
    if (kind === 'logo') setLogoUrl(uploaded.photoUrl);
    else setCoverPhotoUrl(uploaded.photoUrl);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const v = validateShelterApplication({
      shelterName,
      contactPerson,
      phoneNumber,
      publicEmail,
      lat,
      lng,
    });
    if (!v.ok) {
      setError(t(`shelters.applyErr.${v.code}`));
      return;
    }
    setSubmitting(true);
    try {
      await saveShelterApplication(user.uid, {
        shelterName,
        organizationName,
        registrationDetails,
        contactPerson,
        phoneNumber,
        publicEmail,
        addressLine,
        website,
        description,
        logoUrl,
        coverPhotoUrl,
        lat,
        lng,
        city,
      });
    } catch (err) {
      setError(err?.message || t('shelters.applyErr.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!firebaseReady) {
    return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  }

  if (shelterProfile?.status === 'pending') {
    return (
      <div className="pp-grid">
        <div className="pp-col-12 pp-card pp-pad">
          <h1 className="pp-h1">{t('shelters.pendingTitle')}</h1>
          <p className="pp-subtle">{t('shelters.pendingDesc')}</p>
          <Link className="pp-link" to="/shelters">
            {t('shelters.backToBrowse')}
          </Link>
        </div>
      </div>
    );
  }

  if (shelterProfile?.status === 'approved') {
    return (
      <div className="pp-grid">
        <div className="pp-col-12 pp-card pp-pad">
          <h1 className="pp-h1">{t('shelters.approvedTitle')}</h1>
          <Link className="pp-btn pp-btnPrimary" to="/shelter/dashboard">
            {t('shelters.openDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <header className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <h1 className="pp-pageHeader__title">{t('shelters.applyTitle')}</h1>
            <p className="pp-pageHeader__sub">{t('shelters.applySub')}</p>
          </div>
          <Link className="pp-pageHeader__back" to="/shelters">
            {t('shelters.backToBrowse')}
          </Link>
        </header>
      </div>
      <div className="pp-col-12">
        <form className="pp-card pp-pad pp-form" onSubmit={onSubmit}>
          <div>
            <label className="pp-label">{t('shelters.fieldName')}</label>
            <input className="pp-input" value={shelterName} onChange={(e) => setShelterName(e.target.value)} required />
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldOrg')}</label>
            <input className="pp-input" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldRegistration')}</label>
            <textarea className="pp-input" rows={2} value={registrationDetails} onChange={(e) => setRegistrationDetails(e.target.value)} />
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldContact')}</label>
            <input className="pp-input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required />
          </div>
          <div className="pp-formRow">
            <div>
              <label className="pp-label">{t('shelters.fieldPhone')}</label>
              <input className="pp-input" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
            </div>
            <div>
              <label className="pp-label">{t('shelters.fieldEmail')}</label>
              <input className="pp-input" type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldCity')}</label>
            <select className="pp-input" value={city} onChange={(e) => setCity(e.target.value)}>
              {CYPRUS_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldAddress')}</label>
            <input className="pp-input" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldWebsite')}</label>
            <input className="pp-input" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldDescription')}</label>
            <textarea className="pp-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="pp-formRow">
            <div>
              <label className="pp-label">{t('shelters.fieldLogo')}</label>
              <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files?.[0], 'logo')} />
              {logoUrl ? <img src={logoUrl} alt="" style={{ width: 72, height: 72, borderRadius: 16, marginTop: 8 }} /> : null}
            </div>
            <div>
              <label className="pp-label">{t('shelters.fieldCover')}</label>
              <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files?.[0], 'cover')} />
              {coverPhotoUrl ? <img src={coverPhotoUrl} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 16, marginTop: 8 }} /> : null}
            </div>
          </div>
          <div>
            <label className="pp-label">{t('shelters.fieldLocation')}</label>
            <p className="pp-subtle" style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>
              {t('shelters.mapSearchHint')}
            </p>
            <CompanyPlaceSearchField
              onPicked={(nextLat, nextLng, meta) => {
                setPos(nextLat, nextLng);
                if (meta?.placeName && !shelterName.trim()) setShelterName(String(meta.placeName));
                if (meta?.placeAddress && !addressLine.trim()) setAddressLine(String(meta.placeAddress));
              }}
              businessName={shelterName}
              addressLine={addressLine}
            />
            <LocationPicker lat={lat} lng={lng} onChange={setPos} recenterSignal={recenterSignal} />
          </div>
          {error ? <p className="pp-error">{error}</p> : null}
          <button className="pp-btn pp-btnPrimary" type="submit" disabled={submitting || shelterProfileLoading}>
            {submitting ? t('common.saving') : t('shelters.submitApplication')}
          </button>
        </form>
      </div>
    </div>
  );
}
