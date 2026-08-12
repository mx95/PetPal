import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import PositionMap from '../../tracking/PositionMap';
import { clearHomeAnchor, homeCoordsFromPosition, loadHomeAnchor } from '../../tracking/homeAnchorStorage';
import { HOME_GEOFENCE_METERS } from '../../tracking/mapHomeMarker';
import { hasPlausibleMapCoords } from '../../tracking/positionFilter';
import { setHomeCoords, setHomeFromPhone } from '../../tracking/setHomeFromPhone';
import { isTrackingGeolocationEnabled } from '../../tracking/trackingWifiFeature';

const DEFAULT_CENTER = { lat: 34.98, lng: 33.85 };

/**
 * Device-tab home setter: phone GPS or map pin → Live house + 10 m radius.
 * @param {{
 *   imei: string,
 *   position?: object|null,
 *   fallbackLat?: number|null,
 *   fallbackLng?: number|null,
 *   onHomeChanged?: () => void,
 * }} props
 */
export default function TrackDeviceHome({
  imei,
  position = null,
  fallbackLat = null,
  fallbackLng = null,
  onHomeChanged,
}) {
  const { t } = useI18n();
  const geoOk = isTrackingGeolocationEnabled();

  const savedHome = useMemo(() => {
    void imei;
    return homeCoordsFromPosition(position) || loadHomeAnchor(imei);
  }, [imei, position]);

  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    setDraft(savedHome);
    setError('');
    setStatus('');
    setMapOpen(false);
  }, [imei, savedHome?.lat, savedHome?.lng]);

  const mapCenter = useMemo(() => {
    if (draft && hasPlausibleMapCoords(draft)) return draft;
    if (savedHome) return savedHome;
    if (Number.isFinite(Number(fallbackLat)) && Number.isFinite(Number(fallbackLng))) {
      return { lat: Number(fallbackLat), lng: Number(fallbackLng) };
    }
    return DEFAULT_CENTER;
  }, [draft, savedHome, fallbackLat, fallbackLng]);

  const notify = useCallback(() => {
    onHomeChanged?.();
  }, [onHomeChanged]);

  async function handleUsePhone() {
    if (!imei?.trim()) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const coords = await setHomeFromPhone(imei);
      setDraft(coords);
      setStatus(t('trackingPage.deviceHomeSaved'));
      notify();
    } catch (err) {
      if (err?.code === 'geo_unsupported') setError(t('trackingPage.devicePanelHomeGeoUnsupported'));
      else setError(t('trackingPage.devicePanelHomeGeoDenied'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePin() {
    if (!imei?.trim() || !draft) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await setHomeCoords(imei, draft.lat, draft.lng, { source: 'map-pin' });
      setStatus(t('trackingPage.deviceHomeSaved'));
      setMapOpen(false);
      notify();
    } catch {
      setError(t('trackingPage.deviceHomeSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    if (!imei?.trim()) return;
    clearHomeAnchor(imei);
    setDraft(null);
    setStatus(t('trackingPage.deviceHomeClearedLocal'));
    notify();
  }

  return (
    <section className="pp-trackDeviceHome" aria-labelledby="pp-track-device-home-title">
      <h3 id="pp-track-device-home-title">{t('trackingPage.deviceHomeTitle')}</h3>
      <p className="pp-subtle">{t('trackingPage.deviceHomeLead', { meters: HOME_GEOFENCE_METERS })}</p>

      {draft ? (
        <p className="pp-trackDeviceHome__saved">
          {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
        </p>
      ) : (
        <p className="pp-subtle">{t('trackingPage.deviceHomeNone')}</p>
      )}

      {!geoOk ? <p className="pp-subtle">{t('trackingPage.devicePanelHomeNeedsHttps')}</p> : null}

      <div className="pp-trackDeviceHome__actions">
        <button
          type="button"
          className="pp-btn pp-btnPrimary pp-trackDeviceHome__cta"
          disabled={busy || !imei?.trim() || !geoOk}
          onClick={() => void handleUsePhone()}
        >
          {busy ? t('trackingPage.mapOneTapHomeBusy') : t('trackingPage.deviceHomeUsePhone')}
        </button>
        <button
          type="button"
          className="pp-btn pp-btn--ghost"
          disabled={busy || !imei?.trim()}
          onClick={() => setMapOpen((v) => !v)}
        >
          {mapOpen ? t('trackingPage.deviceHomeHideMap') : t('trackingPage.deviceHomePickMap')}
        </button>
        {draft ? (
          <button type="button" className="pp-btn pp-btn--ghost" disabled={busy} onClick={handleClear}>
            {t('trackingPage.deviceHomeClear')}
          </button>
        ) : null}
      </div>

      {mapOpen ? (
        <div className="pp-trackDeviceHome__map">
          <p className="pp-subtle pp-trackDeviceHome__mapHint">{t('trackingPage.deviceHomeMapHint')}</p>
          <div className="pp-trackDeviceHome__mapFrame">
            <PositionMap
              lat={mapCenter.lat}
              lng={mapCenter.lng}
              fill
              homeLocation={draft || mapCenter}
              onMapClick={(coords) => {
                setDraft(coords);
                setStatus('');
                setError('');
              }}
              markerLabel={t('trackingPage.deviceHomePinLabel')}
              mapActive
            />
          </div>
          <button
            type="button"
            className="pp-btn pp-btnPrimary"
            disabled={busy || !draft || !imei?.trim()}
            onClick={() => void handleSavePin()}
          >
            {t('trackingPage.deviceHomeSavePin')}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="pp-error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="pp-trackDevicePanel__status" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
