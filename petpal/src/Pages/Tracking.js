import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import PetAvatar from '../components/PetAvatar';
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
  const { pets, updatePet } = usePets();
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
          <div className="pp-card pp-pad" style={{ textAlign: 'center', padding: 28 }}>
            <div style={{ fontSize: 44 }} aria-hidden>
              🐾
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('trackingPage.emptyTitle')}
            </h1>
            <p className="pp-subtle" style={{ marginBottom: 16, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
              {t('trackingPage.emptyBody')}
            </p>
            <Link className="pp-btn pp-btnPrimary pp-btn--lg" to="/pets#add-pet" style={{ textDecoration: 'none', display: 'inline-block' }}>
              {t('trackingPage.myPetsCta')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const langForDate = language === 'el' ? 'el' : language === 'ru' ? 'ru' : 'en';

  const lastSeenLabel = position?.deviceTime ? formatTime(position.deviceTime, langForDate) : null;
  const signalLive = position != null;

  return (
    <div className="pp-feed pp-tracker-page">
      <header className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <span className="pp-publicHero__eyebrow" style={{ display: 'inline-block', width: 'fit-content' }}>
            {t('trackingPage.badgeTraccar')}
          </span>
          <h1 className="pp-pageHeader__title">
            {selectedPet ? t('trackingPage.titleWithPet', { name: selectedPet.name }) : t('trackingPage.title')}
          </h1>
          <p className="pp-pageHeader__sub">{t('trackingPage.intro')}</p>
        </div>
        <Link className="pp-pageHeader__back" to="/dashboard">
          {t('common.backDashboard')}
        </Link>
      </header>

      <section className="pp-trackPetStrip" aria-label={t('trackingPage.petSelectLabel')}>
        <div className="pp-trackPetScroll">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pp-trackPetCard ${selectedPetId === p.id ? 'pp-trackPetCard--on' : ''}`}
              onClick={() => setSelectedPetId(p.id)}
            >
              <PetAvatar pet={p} size={44} />
              <span className="pp-trackPetCard__name">{p.name}</span>
              <span className="pp-trackPetCard__chip">
                {p.trackingDeviceId ? t('trackingPage.deviceChip', { id: p.trackingDeviceId }) : t('trackingPage.noDeviceChip')}
              </span>
            </button>
          ))}
        </div>
      </section>

      {selectedPet ? (
        <section className="pp-card pp-pad pp-trackTop" aria-label={selectedPet.name}>
          <div className="pp-trackTop__main">
            <PetAvatar pet={selectedPet} size={56} />
            <div className="pp-trackTop__meta">
              <h2 className="pp-trackTop__title">{selectedPet.name}</h2>
              <div className="pp-trackTop__statusRow">
                <span className={`pp-trackPill ${signalLive ? 'pp-trackPill--live' : ''}`}>
                  {signalLive ? t('trackingPage.signalLive') : t('trackingPage.signalQuiet')}
                </span>
                <span className="pp-subtle pp-trackTop__muted">
                  📡 {dataSourceLabel}
                </span>
              </div>
              <p className="pp-subtle pp-trackTop__sub">
                {signalLive && lastSeenLabel
                  ? t('trackingPage.heroLastSeen', { when: lastSeenLabel })
                  : selectedPet.trackingDeviceId
                    ? t('trackingPage.heroNoFix')
                    : t('trackingPage.heroNoDevice')}
              </p>
            </div>
          </div>
          <div className="pp-trackTop__fabs">
            <button
              type="button"
              className="pp-trackFab pp-trackFab--prim"
              disabled={loading || !deviceId.trim()}
              onClick={() => void refresh()}
            >
              {loading ? t('trackingPage.btnRefresh') : t('trackingPage.btnLocate')}
            </button>
            <button type="button" className="pp-trackFab" disabled={loading || !deviceId.trim()} onClick={() => void refresh()}>
              {t('trackingPage.quickRefresh')}
            </button>
            <Link className="pp-trackFab pp-trackFab--link" to="/pets">
              {t('trackingPage.managePets')}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="pp-card pp-pad pp-trackMapShell">
        {position ? (
          <>
            <div className="pp-trackMapHead">
              <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
                {t('trackingPage.sectionMap')}
              </h2>
              <a
                className="pp-btn pp-btn--ghost"
                href={mapsLink(position.lat, position.lng)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                {t('trackingPage.openGoogleMaps')}
              </a>
            </div>
            <p className="pp-subtle pp-trackMapHint">{t('trackingPage.mapTilesHint')}</p>
            <div className="pp-trackMapFrame">
              <PositionMap lat={position.lat} lng={position.lng} />
            </div>
            <div className="pp-trackMapMeta">
              <span>
                {t('trackingPage.lblLatLng')}: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </span>
              {position.speed != null ? (
                <span>
                  {t('trackingPage.lblSpeed')}: {Number(position.speed).toFixed(1)} {t('trackingPage.speedUnitMs')}
                </span>
              ) : null}
              <span>
                {t('trackingPage.lblDeviceTime')}: {formatTime(position.deviceTime, langForDate)}
              </span>
            </div>
          </>
        ) : (
          <div className="pp-trackMapEmpty">
            <p className="pp-subtle" style={{ margin: 0 }}>
              {error || t('trackingPage.mapPlaceholder')}
            </p>
          </div>
        )}
      </section>

      <section className="pp-card pp-pad pp-trackDeviceCard">
        <h2 className="pp-sectionTitle">{t('trackingPage.sectionPetDevice')}</h2>
        <form className="pp-form pp-trackDeviceForm" onSubmit={saveIdAndLoad}>
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
          {!position && error ? <div className="pp-error">{error}</div> : null}
          <button className="pp-btn pp-btnPrimary" type="submit" disabled={loading || !deviceId.trim()}>
            {loading ? t('trackingPage.btnRefresh') : t('trackingPage.btnSaveLoad')}
          </button>
        </form>
      </section>
    </div>
  );
}
