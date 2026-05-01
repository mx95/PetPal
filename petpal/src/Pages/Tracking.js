import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import PositionMap from '../tracking/PositionMap';
import { usePets } from '../pets/PetsContext';
import { getLatestPosition, getTrackingDataSource, mapsLink } from '../tracking/traccarClient';

function formatTime(iso, lang) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'el' ? 'el' : lang === 'ru' ? 'ru' : undefined);
  } catch {
    return String(iso);
  }
}

export default function Tracking() {
  const { t, language } = useI18n();
  const fieldId = useId();
  const { pets, getCategory, updatePet } = usePets();
  const dataSource = getTrackingDataSource();
  const dataSourceLabel = {
    bff: t('trackingPage.dsBff'),
    traccar: t('trackingPage.dsTraccar'),
    mock: t('trackingPage.dsMock'),
  }[dataSource];

  const [selectedPetId, setSelectedPetId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPet = useMemo(() => pets.find((p) => p.id === selectedPetId), [pets, selectedPetId]);

  useEffect(() => {
    if (pets.length === 0) {
      setSelectedPetId('');
      return;
    }
    setSelectedPetId((cur) => (cur && pets.some((p) => p.id === cur) ? cur : pets[0].id));
  }, [pets]);

  useEffect(() => {
    if (!selectedPetId) {
      setDeviceId('');
      return;
    }
    const p = pets.find((x) => x.id === selectedPetId);
    setDeviceId(p?.trackingDeviceId || '');
  }, [selectedPetId, pets]);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const p = await getLatestPosition(deviceId);
      setPosition(p);
    } catch (e) {
      setPosition(null);
      setError(e?.message || t('trackingPage.errLoadPosition'));
    } finally {
      setLoading(false);
    }
  }, [deviceId, t]);

  function saveIdAndLoad(e) {
    e?.preventDefault();
    if (selectedPetId) {
      updatePet(selectedPetId, { trackingDeviceId: deviceId.trim() || null });
    }
    void refresh();
  }

  if (pets.length === 0) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <div className="pp-badge">{t('trackingPage.badgeTraccar')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('trackingPage.emptyTitle')}
            </h1>
            <p className="pp-subtle" style={{ marginBottom: 16 }}>
              {t('trackingPage.emptyBody')}
            </p>
            <Link className="pp-btn pp-btnPrimary" to="/pets" style={{ textDecoration: 'none', display: 'inline-block' }}>
              {t('trackingPage.myPetsCta')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const langForDate = language === 'el' ? 'el' : language === 'ru' ? 'ru' : 'en';

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div className="pp-badge">{t('trackingPage.badgeTraccar')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('trackingPage.title')}
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 720 }}>
              {t('trackingPage.intro')}
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            {t('common.backDashboard')}
          </Link>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">{t('trackingPage.sectionPetDevice')}</h2>
          <p className="pp-subtle" style={{ marginBottom: 12, fontSize: 14 }}>
            {t('trackingPage.dataSource')} <strong>{dataSourceLabel}</strong>
          </p>
          <div className="pp-form" style={{ marginBottom: 12 }}>
            <div>
              <div className="pp-label">{t('trackingPage.petSelectLabel')}</div>
              <select className="pp-input" value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getCategory(p).emoji} {p.name}
                    {p.trackingDeviceId
                      ? ` ${t('trackingPage.deviceSuffix', { id: p.trackingDeviceId })}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <form className="pp-form" onSubmit={saveIdAndLoad}>
            <div>
              <label className="pp-label" htmlFor={fieldId}>
                {t('trackingPage.deviceIdLabel')}
              </label>
              <input
                id={fieldId}
                className="pp-input"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder={t('trackingPage.deviceIdPh')}
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            {selectedPet ? (
              <p className="pp-subtle" style={{ fontSize: 13, margin: 0 }}>
                {t('trackingPage.persistHintSaving', { name: selectedPet.name })}
              </p>
            ) : null}
            {error ? <div className="pp-error">{error}</div> : null}
            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <button className="pp-btn pp-btnPrimary" type="submit" disabled={loading || !deviceId.trim()}>
                {loading ? t('trackingPage.btnRefresh') : t('trackingPage.btnSaveLoad')}
              </button>
              <Link className="pp-link" to="/pets">
                {t('trackingPage.managePets')}
              </Link>
            </div>
          </form>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">{t('trackingPage.sectionLastFix')}</h2>
          {!position && !error ? <p className="pp-subtle">{t('trackingPage.hintNeedId')}</p> : null}
          {position ? (
            <div className="pp-form" style={{ gap: 8 }}>
              <div>
                <div className="pp-label">{t('trackingPage.lblLatLng')}</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </div>
              </div>
              {position.speed != null ? (
                <div>
                  <div className="pp-label">{t('trackingPage.lblSpeed')}</div>
                  <div style={{ fontWeight: 800 }}>
                    {Number(position.speed).toFixed(1)} {t('trackingPage.speedUnitMs')}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="pp-label">{t('trackingPage.lblDeviceTime')}</div>
                <div>{formatTime(position.deviceTime, langForDate)}</div>
              </div>
              {position.address ? (
                <div>
                  <div className="pp-label">{t('trackingPage.lblAddress')}</div>
                  <div>{position.address}</div>
                </div>
              ) : null}
              <div>
                <div className="pp-label">{t('trackingPage.lblSource')}</div>
                <div style={{ textTransform: 'capitalize' }}>{position.source}</div>
              </div>
              <a
                className="pp-link"
                href={mapsLink(position.lat, position.lng)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 800 }}
              >
                {t('trackingPage.openGoogleMaps')}
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {position ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <h2 className="pp-sectionTitle">{t('trackingPage.sectionMap')}</h2>
            <p className="pp-subtle" style={{ marginBottom: 12, fontSize: 14 }}>
              {t('trackingPage.mapTilesHint')}
            </p>
            <PositionMap lat={position.lat} lng={position.lng} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
