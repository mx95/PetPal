import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n/I18nContext';
import { deleteSafeZone, saveSafeZone } from '../../notifications/notificationsFirestore';
import PositionMap from '../../tracking/PositionMap';
import { hasPlausibleMapCoords } from '../../tracking/positionFilter';
import { isTrackingGeolocationEnabled } from '../../tracking/trackingWifiFeature';
import NotificationSettings from '../notifications/NotificationSettings';

const DEFAULT_CENTER = { lat: 34.98, lng: 33.85 };
const MIN_RADIUS = 50;
const MAX_RADIUS = 2000;
const DEFAULT_RADIUS = 200;

function sameZone(a, b) {
  if (!a || !b) return false;
  return (
    a.enabled === b.enabled &&
    a.notifyExit === b.notifyExit &&
    a.notifyEnter === b.notifyEnter &&
    Math.round(a.radiusM) === Math.round(b.radiusM) &&
    Math.abs(a.lat - b.lat) < 1e-6 &&
    Math.abs(a.lng - b.lng) < 1e-6
  );
}

/**
 * One safe zone per pet (circle). The tracker server compares trusted GPS fixes to it and sends
 * zone exit/enter alerts. Coordinates live in a private Firestore doc, never on the public pet profile.
 * @param {{ pet: { id: string, name?: string } | null, imei: string, saved: object|null, loaded: boolean, livePos: {lat:number,lng:number}|null }} props
 */
export default function SafeZoneTab({ pet, imei, saved, loaded, livePos }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const uid = user?.uid || '';
  const petId = pet?.id || '';
  const geoOk = isTrackingGeolocationEnabled();

  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(null);
    setStatus('');
    setError('');
  }, [petId]);

  useEffect(() => {
    setDraft((prev) => prev ?? saved);
  }, [saved]);

  const center = useMemo(() => {
    if (draft && hasPlausibleMapCoords(draft)) return { lat: draft.lat, lng: draft.lng };
    if (livePos && hasPlausibleMapCoords(livePos)) return livePos;
    return DEFAULT_CENTER;
  }, [draft, livePos]);

  const dirty = draft && !sameZone(draft, saved);

  function patch(next) {
    setStatus('');
    setError('');
    setDraft((prev) => ({
      enabled: true,
      notifyExit: true,
      notifyEnter: true,
      radiusM: DEFAULT_RADIUS,
      ...(prev || center),
      ...next,
    }));
  }

  function usePetLocation() {
    if (livePos && hasPlausibleMapCoords(livePos)) patch({ lat: livePos.lat, lng: livePos.lng });
  }

  function usePhoneLocation() {
    if (!navigator.geolocation) {
      setError(t('safeZone.geoUnsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => patch({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError(t('safeZone.geoDenied')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  async function handleSave() {
    if (!uid || !petId || !draft) return;
    setBusy(true);
    setError('');
    try {
      await saveSafeZone(uid, petId, draft);
      setStatus(t('safeZone.saved'));
    } catch {
      setError(t('safeZone.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!uid || !petId) return;
    setBusy(true);
    setError('');
    try {
      await deleteSafeZone(uid, petId);
      setDraft(null);
      setStatus(t('safeZone.removed'));
    } catch {
      setError(t('safeZone.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!pet) {
    return (
      <section className="pp-card pp-pad">
        <p className="pp-subtle">{t('safeZone.noPet')}</p>
      </section>
    );
  }

  return (
    <div className="pp-safeZone">
      <section className="pp-card pp-pad" aria-labelledby="pp-safe-zone-title">
        <h3 id="pp-safe-zone-title" className="pp-sectionTitle" style={{ marginTop: 0 }}>
          {t('safeZone.title', { name: pet.name || '' })}
        </h3>
        <p className="pp-subtle">{t('safeZone.lead')}</p>
        {!imei ? <p className="pp-subtle pp-safeZone__warn">{t('safeZone.noTracker')}</p> : null}

        <div className="pp-safeZone__map">
          <PositionMap
            lat={center.lat}
            lng={center.lng}
            fill
            mapActive
            safeZone={draft ? { ...draft, enabled: true } : null}
            onMapClick={(coords) => patch({ lat: coords.lat, lng: coords.lng })}
            markerLabel={pet.name || ''}
          />
        </div>
        <p className="pp-subtle pp-safeZone__hint">{t('safeZone.mapHint')}</p>

        <div className="pp-safeZone__actions">
          <button type="button" className="pp-btn pp-btn--ghost" disabled={!livePos || busy} onClick={usePetLocation}>
            {t('safeZone.usePet')}
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" disabled={!geoOk || busy} onClick={usePhoneLocation}>
            {t('safeZone.usePhone')}
          </button>
        </div>

        {draft ? (
          <div className="pp-safeZone__form">
            <label className="pp-safeZone__radius">
              <span>
                <strong>{t('safeZone.radius')}</strong>: {Math.round(draft.radiusM)} m
              </span>
              <input
                type="range"
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={10}
                value={Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, draft.radiusM))}
                onChange={(e) => patch({ radiusM: Number(e.target.value) })}
              />
            </label>
            <label className="pp-notifySettings__row">
              <input type="checkbox" checked={draft.enabled !== false} onChange={(e) => patch({ enabled: e.target.checked })} />
              <span>
                <strong>{t('safeZone.enabled')}</strong>
              </span>
            </label>
            <label className="pp-notifySettings__row">
              <input type="checkbox" checked={draft.notifyExit !== false} onChange={(e) => patch({ notifyExit: e.target.checked })} />
              <span>{t('safeZone.notifyExit')}</span>
            </label>
            <label className="pp-notifySettings__row">
              <input type="checkbox" checked={draft.notifyEnter !== false} onChange={(e) => patch({ notifyEnter: e.target.checked })} />
              <span>{t('safeZone.notifyEnter')}</span>
            </label>
            <p className="pp-subtle">{t('safeZone.accuracyNote')}</p>
          </div>
        ) : loaded ? (
          <p className="pp-subtle">{t('safeZone.none')}</p>
        ) : null}

        <div className="pp-safeZone__actions">
          {!draft && loaded ? (
            <button type="button" className="pp-btn pp-btnPrimary" onClick={() => patch({})}>
              {t('safeZone.create')}
            </button>
          ) : null}
          {draft ? (
            <button type="button" className="pp-btn pp-btnPrimary" disabled={busy || !dirty} onClick={() => void handleSave()}>
              {busy ? t('safeZone.saving') : t('safeZone.save')}
            </button>
          ) : null}
          {saved ? (
            <button type="button" className="pp-btn pp-btn--ghost" disabled={busy} onClick={() => void handleRemove()}>
              {t('safeZone.remove')}
            </button>
          ) : null}
        </div>
        {status ? (
          <p className="pp-safeZone__ok" role="status">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="pp-notifySettings__err" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <NotificationSettings />
    </div>
  );
}
