import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { saveCompanyApplication } from '../company/companyFirestore';
import LocationPicker, { defaultMapCenter } from '../company/LocationPicker';
import CompanyPlaceSearchField from '../company/CompanyPlaceSearchField';
import { useI18n } from '../i18n/I18nContext';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

const BUSINESS_TYPES = [
  { id: 'vet_clinic', labelKey: 'businessTypeVetClinic' },
  { id: 'pet_shop', labelKey: 'businessTypePetShop' },
  { id: 'pet_hotel', labelKey: 'businessTypePetHotel' },
  { id: 'pet_walker', labelKey: 'businessTypePetWalkers' },
  { id: 'other', labelKey: 'businessTypeOther' },
];

const BUSINESS_TYPE_KEY_BY_ID = BUSINESS_TYPES.reduce((map, type) => {
  map[type.id] = type.labelKey;
  return map;
}, {});

const STATUS_LABEL_KEYS = {
  approved: 'statusApproved',
  pending: 'statusPending',
  rejected: 'statusRejected',
};

function getBusinessTypeLabel(t, businessType) {
  const key = BUSINESS_TYPE_KEY_BY_ID[businessType] || 'businessTypeOther';
  return t(`companyApply.${key}`);
}

function getStatusLabel(t, status) {
  const key = STATUS_LABEL_KEYS[status];
  return key ? t(`companyApply.${key}`) : status || '';
}

export default function CompanyApply() {
  const { user } = useAuth();
  const { state: locationState } = useLocation();
  const { profiles, profileLoading, firebaseReady } = useCompany();
  const { t } = useI18n();

  const [modalOpen, setModalOpen] = useState(false);
  const [businessName, setBusinessName] = useState(
    () => (locationState && typeof locationState === 'object' && locationState.businessName) || ''
  );
  const [businessType, setBusinessType] = useState('other');
  const [logoUrl, setLogoUrl] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [publicEmail, setPublicEmail] = useState(() => (user && user.email) || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [lat, setLat] = useState(defaultMapCenter.lat);
  const [lng, setLng] = useState(defaultMapCenter.lng);
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [recenterSignal, setRecenterSignal] = useState(0);

  const setPos = useCallback((nextLat, nextLng) => {
    setLat(nextLat);
    setLng(nextLng);
  }, []);

  const onPlacePicked = useCallback(
    (nextLat, nextLng, meta = {}) => {
      setPos(nextLat, nextLng);
      if (meta.placeId) setGooglePlaceId(String(meta.placeId));
      if (meta.placeAddress) setAddressLine((line) => line.trim() || String(meta.placeAddress));
      if (meta.placeName) setBusinessName((name) => name.trim() || String(meta.placeName));
      if (meta.phoneNumber) setPhoneNumber((phone) => phone.trim() || String(meta.phoneNumber));
      if (meta.workingHours) setWorkingHours((hours) => hours.trim() || String(meta.workingHours));
      setRecenterSignal((n) => n + 1);
    },
    [setPos]
  );

  const sortedProfiles = useMemo(() => {
    const rows = Array.isArray(profiles) ? profiles : [];
    return [...rows].sort((a, b) => {
      const ta = a?.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const tb = b?.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return tb - ta;
    });
  }, [profiles]);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (g) => setPos(g.coords.latitude, g.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }, [setPos]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  useEffect(() => {
    const cls = 'pp-noScroll';
    if (modalOpen) document.body.classList.add(cls);
    else document.body.classList.remove(cls);
    return () => document.body.classList.remove(cls);
  }, [modalOpen]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!user?.uid) {
      setError(t('companyApply.signInRequired'));
      return;
    }
    if (!businessName.trim()) {
      setError(t('companyApply.businessNameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await saveCompanyApplication(user.uid, {
        businessName: businessName.trim(),
        businessType,
        logoUrl,
        addressLine,
        publicEmail: publicEmail.trim(),
        phoneNumber,
        workingHours,
        lat,
        lng,
        googlePlaceId,
        pickedPlaceName: businessName.trim(),
      });
      setModalOpen(false);
      setBusinessName('');
      setBusinessType('other');
      setLogoUrl('');
      setAddressLine('');
      setPublicEmail((user && user.email) || '');
      setPhoneNumber('');
      setWorkingHours('');
      setGooglePlaceId('');
    } catch (err) {
      const c = err?.code || err?.message || '';
      if (c.includes('permission') || c.includes('PERMISSION')) {
        setError(t('companyApply.permissionDeniedDetailed'));
      } else if (c === 'firebase_unconfigured' || err?.message === 'firebase_unconfigured') {
        setError(t('companyApply.firebaseEnvSetupErrorDetailed'));
      } else {
        setError(err?.message || t('companyApply.couldNotSaveApplication'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-subtle">{t('companyApply.loadingBusinesses')}</p>
        </div>
      </div>
    );
  }

  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12" style={{ maxWidth: 640 }}>
          <div className="pp-error">{t('companyApply.firebaseNotConfiguredDetailed')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12" style={{ maxWidth: 960 }}>
        <h1 className="pp-h1" style={{ marginTop: 10 }}>
          {t('companyApply.heroTitle')}
        </h1>
        <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 760 }}>
          {t('companyApply.heroDescription')}
        </p>

        <div className="pp-row" style={{ marginTop: 12 }}>
          <button type="button" className="pp-btn pp-btnPrimary" onClick={() => setModalOpen(true)} style={{ marginLeft: 'auto' }}>
            + {t('companyApply.addBusiness')}
          </button>
        </div>
      </div>

      <div className="pp-col-12" style={{ maxWidth: 960 }}>
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">{t('companyApply.yourBusinessesTitle', { count: sortedProfiles.length })}</h2>
          {sortedProfiles.length === 0 ? (
            <p className="pp-subtle">{t('companyApply.noBusinessesYetDescription')}</p>
          ) : (
            <ul className="pp-petList">
              {sortedProfiles.map((c) => (
                <li key={c.id || `${c.businessName}-${c.lat}-${c.lng}`} className="pp-petList__item">
                  <div className="pp-petList__row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="pp-petList__name">🏪 {c.businessName}</div>
                      <div className="pp-petList__tags" style={{ marginTop: 8 }}>
                        <span className="pp-petTag">{getBusinessTypeLabel(t, c.businessType)}</span>
                        <span
                          className="pp-petTag"
                          style={{
                            borderColor:
                              c.status === 'approved'
                                ? 'rgba(22,163,74,.45)'
                                : c.status === 'pending'
                                  ? 'rgba(59,130,246,.45)'
                                  : 'rgba(220,38,38,.45)',
                            background:
                              c.status === 'approved'
                                ? 'rgba(22,163,74,.10)'
                                : c.status === 'pending'
                                  ? 'rgba(59,130,246,.10)'
                                  : 'rgba(220,38,38,.10)',
                            color:
                              c.status === 'approved'
                                ? '#166534'
                                : c.status === 'pending'
                                  ? '#1d4ed8'
                                  : '#991b1b',
                          }}
                        >
                          {getStatusLabel(t, c.status)}
                        </span>
                      </div>
                      {c.addressLine ? <div className="pp-petList__meta" style={{ marginTop: 8 }}>{c.addressLine}</div> : null}
                      {c.publicEmail ? (
                        <div className="pp-petList__meta" style={{ marginTop: 4 }}>
                          <strong>{t('companyApply.emailLabel')}:</strong> {c.publicEmail}
                        </div>
                      ) : null}
                      {c.phoneNumber ? (
                        <div className="pp-petList__meta" style={{ marginTop: 4 }}>
                          <strong>{t('companyApply.phoneLabel')}:</strong> {c.phoneNumber}
                        </div>
                      ) : null}
                      {c.workingHours ? <p className="pp-petList__desc">{c.workingHours}</p> : null}
                      {c.status === 'rejected' && c.rejectionNote ? (
                        <p className="pp-error" style={{ marginTop: 8, marginBottom: 0 }}>
                          {t('companyApply.rejectionMessage', { note: c.rejectionNote })}
                        </p>
                      ) : null}
                      {c.lat != null && c.lng != null ? (
                        <p style={{ marginTop: 8, marginBottom: 0 }}>
                          <a className="pp-link" href={mapsLink(c.lat, c.lng)} target="_blank" rel="noopener noreferrer">
                            {t('companyApply.previewInGoogleMaps')}
                          </a>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {modalOpen ? (
        <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="add-business-title">
          <button type="button" className="pp-modalBackdrop" aria-label={t('companyApply.close')} onClick={() => setModalOpen(false)} />
          <div className="pp-modalCard pp-modalCard--petAdd" style={{ maxWidth: 1120, width: 'min(1120px, calc(100vw - 24px))' }}>
            <div className="pp-modalHead">
              <div>
                <h2 id="add-business-title" className="pp-sectionTitle" style={{ margin: 0 }}>
                  {t('companyApply.addBusinessTitle')}
                </h2>
              </div>
              <button
                type="button"
                className="pp-btn"
                onClick={() => setModalOpen(false)}
                aria-label={t('companyApply.close')}
                title={t('companyApply.close')}
              >
                ✕
              </button>
            </div>

            <form className="pp-form pp-modalForm" onSubmit={onSubmit}>
              <div className="pp-companyMapSection">
                <div className="pp-label">{t('companyApply.findBusinessOnMap')}</div>
                <p className="pp-subtle" style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>
                  {t('companyApply.prefillFromSearchHint')}
                </p>
                <CompanyPlaceSearchField onPicked={onPlacePicked} businessName={businessName} addressLine={addressLine} />
                <div className="pp-label" style={{ marginTop: 14 }}>{t('companyApply.pinPosition')}</div>
                <LocationPicker lat={lat} lng={lng} onChange={setPos} recenterSignal={recenterSignal} />
                <p className="pp-subtle" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                  <a className="pp-link" style={{ display: 'inline' }} href={mapsLink(lat, lng)} target="_blank" rel="noopener noreferrer">
                    {t('companyApply.previewInGoogleMaps')}
                  </a>
                </p>
              </div>

              <div>
                <div className="pp-label">{t('companyApply.businessOrVenueName')}</div>
                <input
                  className="pp-input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  maxLength={120}
                  placeholder={t('companyApply.businessNamePlaceholder')}
                />
              </div>

              <div>
                <div className="pp-label">{t('companyApply.businessTypeLabel')}</div>
                <div className="pp-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  {BUSINESS_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className={`pp-btn ${businessType === type.id ? 'pp-btnPrimary' : ''}`}
                      onClick={() => setBusinessType(type.id)}
                    >
                      {t(`companyApply.${type.labelKey}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="pp-label">{t('companyApply.businessLogoUrl')}</div>
                <input
                  className="pp-input"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder={t('companyApply.logoUrlPlaceholder')}
                />
              </div>

              <div>
                <div className="pp-label">{t('companyApply.addressLabel')}</div>
                <input
                  className="pp-input"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  maxLength={200}
                  placeholder={t('companyApply.addressPlaceholder')}
                />
              </div>

              <div>
                <div className="pp-label">{t('companyApply.contactEmail')}</div>
                <input
                  className="pp-input"
                  type="email"
                  value={publicEmail}
                  onChange={(e) => setPublicEmail(e.target.value)}
                  placeholder={t('companyApply.contactEmailPlaceholder')}
                />
              </div>

              <div>
                <div className="pp-label">{t('companyApply.phoneNumber')}</div>
                <input
                  className="pp-input"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t('companyApply.phoneNumberPlaceholder')}
                />
              </div>

              <div>
                <div className="pp-label">{t('companyApply.workingHoursLabel')}</div>
                <textarea
                  className="pp-input"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  style={{ minHeight: 80, resize: 'vertical' }}
                  placeholder={t('companyApply.workingHoursPlaceholder')}
                />
              </div>

              {error ? <div className="pp-error">{error}</div> : null}

              <div className="pp-modalActions">
                <button type="button" className="pp-btn" onClick={() => setModalOpen(false)}>
                  {t('companyApply.cancel')}
                </button>
                <button type="submit" className="pp-btn pp-btnPrimary" disabled={submitting}>
                  {submitting ? t('companyApply.submitting') : t('companyApply.submitForReview')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
