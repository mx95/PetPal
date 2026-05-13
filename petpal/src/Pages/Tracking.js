import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import PetAvatar from '../components/PetAvatar';
import PositionMap from '../tracking/PositionMap';
import { usePets } from '../pets/PetsContext';
import { getLatestPosition, getTrackingDataSource, mapsLink } from '../tracking/petpalVendorClient';

const LAST_LIVE_PET_KEY = 'petpal_live_selectedPetId';

function formatTime(iso, lang) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'el' ? 'el' : lang === 'ru' ? 'ru' : undefined);
  } catch {
    return String(iso);
  }
}

const MIN = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** Relative “last update”: seconds → minutes → hours → days → weeks → months */
function formatLastSeen(secondsAgo, t) {
  if (secondsAgo == null || !Number.isFinite(secondsAgo)) return t('trackingPage.lastUpdateUnknown');
  const s = Math.max(0, secondsAgo);
  if (s < 60) return t('trackingPage.lastUpdateSeconds', { seconds: Math.max(0, Math.round(s)) });
  if (s < HOUR) return t('trackingPage.lastUpdateMinutes', { minutes: Math.max(1, Math.floor(s / MIN)) });
  if (s < DAY) {
    const hours = Math.max(1, Math.floor(s / HOUR));
    return t('trackingPage.lastUpdateHours', { hours });
  }
  if (s < WEEK) {
    const n = Math.max(1, Math.floor(s / DAY));
    const unit = n === 1 ? t('trackingPage.timeUnitDay') : t('trackingPage.timeUnitDays');
    return t('trackingPage.lastUpdateDays', { n, unit });
  }
  if (s < 4 * WEEK) {
    const n = Math.max(1, Math.floor(s / WEEK));
    const unit = n === 1 ? t('trackingPage.timeUnitWeek') : t('trackingPage.timeUnitWeeks');
    return t('trackingPage.lastUpdateWeeks', { n, unit });
  }
  if (s < 365 * DAY) {
    const n = Math.max(1, Math.floor(s / MONTH));
    const unit = n === 1 ? t('trackingPage.timeUnitMonth') : t('trackingPage.timeUnitMonths');
    return t('trackingPage.lastUpdateMonths', { n, unit });
  }
  const months = Math.floor(s / MONTH);
  return t('trackingPage.lastUpdateMonthsLong', { months: Math.max(12, months) });
}

function batteryFillStyle(pct) {
  const n = Math.min(100, Math.max(0, pct));
  let fill;
  if (n > 60) fill = 'linear-gradient(90deg,#22c55e,#4ade80)';
  else if (n > 30) fill = 'linear-gradient(90deg,#eab308,#facc15)';
  else fill = 'linear-gradient(90deg,#f97316,#ef4444)';
  return { width: `${n}%`, background: fill };
}

function hasDiagnostics(position) {
  return Boolean(position?.diagnostics?.received || position?.diagnostics?.raw);
}

function accuracyMeterStyle(position) {
  const approx = position?.warningApproximate || position?.accuracy === 'low' || position?.source === 'lbs';
  const stale = Boolean(position?.warningStale);
  const lbs = position?.source === 'lbs';
  if (stale) {
    return { width: '24%', background: 'linear-gradient(90deg,#fb923c,#dc2626)' };
  }
  if (lbs) {
    return { width: '38%', background: 'linear-gradient(90deg,#f97316,#ea580c)' };
  }
  if (approx) {
    return { width: '58%', background: 'linear-gradient(90deg,#eab308,#f59e0b)' };
  }
  return { width: '96%', background: 'linear-gradient(90deg,#22c55e,#86efac)' };
}

export default function Tracking() {
  const { t, language } = useI18n();
  const fieldId = useId();
  const { pets, updatePet } = usePets();
  const dataSource = getTrackingDataSource();
  void dataSource;

  const [selectedPetId, setSelectedPetId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPet = useMemo(() => pets.find((p) => p.id === selectedPetId), [pets, selectedPetId]);

  /** Typed IMEI wins; otherwise use value saved on the pet (avoids empty requests if the field was cleared). */
  const effectiveDeviceId = useMemo(
    () => (deviceId.trim() || selectedPet?.trackingDeviceId?.trim() || ''),
    [deviceId, selectedPet?.trackingDeviceId]
  );

  const savedDeviceIdTrimmed = useMemo(() => (selectedPet?.trackingDeviceId || '').trim(), [selectedPet?.trackingDeviceId]);

  const imeiDirty = savedDeviceIdTrimmed !== deviceId.trim();

  useEffect(() => {
    if (pets.length === 0) {
      setSelectedPetId('');
      return;
    }
    setSelectedPetId((cur) => {
      try {
        const saved = localStorage.getItem(LAST_LIVE_PET_KEY);
        if (saved && pets.some((p) => p.id === saved)) return saved;
      } catch (_) {}
      if (cur && pets.some((p) => p.id === cur)) return cur;
      return pets[0].id;
    });
  }, [pets]);

  useEffect(() => {
    if (!selectedPetId) return;
    try {
      localStorage.setItem(LAST_LIVE_PET_KEY, selectedPetId);
    } catch (_) {}
  }, [selectedPetId]);

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
      const p = await getLatestPosition(effectiveDeviceId);
      setPosition(p);
    } catch (e) {
      setPosition(null);
      setError(e?.message || t('trackingPage.errLoadPosition'));
    } finally {
      setLoading(false);
    }
  }, [effectiveDeviceId, t]);

  useEffect(() => {
    if (!effectiveDeviceId.trim()) return;
    void refresh();
  }, [effectiveDeviceId, refresh]);

  useEffect(() => {
    if (!effectiveDeviceId) return;
    const ms = 12_000;
    const id = window.setInterval(() => {
      void refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [effectiveDeviceId, refresh]);

  function saveIdAndLoad(e) {
    e?.preventDefault();
    const next = deviceId.trim();
    const prev = savedDeviceIdTrimmed;

    if (prev && next && next !== prev) {
      if (!window.confirm(t('trackingPage.imeiConfirmChange', { from: prev, to: next }))) return;
    }
    if (prev && !next) {
      if (!window.confirm(t('trackingPage.imeiConfirmClear'))) return;
    }

    if (selectedPetId) {
      updatePet(selectedPetId, { trackingDeviceId: next || null });
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

  const signalLive = position != null;
  const hasCoordinates = position?.lat != null && position?.lng != null;
  const approx = position?.warningApproximate || position?.accuracy === 'low' || position?.source === 'lbs';
  const accuracyLabel = approx ? t('trackingPage.accuracyApprox') : t('trackingPage.accuracyHigh');
  const secondsAgo =
    typeof position?.secondsAgo === 'number' && Number.isFinite(position.secondsAgo) ? position.secondsAgo : null;
  const lastUpdateLabel = formatLastSeen(secondsAgo, t);

  const gpsOkVisual = hasCoordinates && !approx && position?.source !== 'lbs' && !position?.warningStale;

  const deviceTimeLabel = position?.deviceTimeLocal
    ? position.deviceTimeLocal
    : position?.deviceTime
      ? formatTime(position.deviceTime, langForDate)
      : '—';

  const batPct = position?.battery != null ? Math.min(100, Math.max(0, Number(position.battery))) : null;

  const accMeter = position ? accuracyMeterStyle(position) : null;
  const trackingActions = (
    <div className="pp-row pp-trackMapActions" style={{ gap: 8, flexWrap: 'wrap', margin: '12px 0 10px' }}>
      <button
        type="button"
        className="pp-btn pp-btnPrimary"
        disabled={loading || !effectiveDeviceId}
        onClick={() => void refresh()}
      >
        {t('trackingPage.btnLocate')}
      </button>
      <button type="button" className="pp-btn" disabled={loading || !effectiveDeviceId} onClick={() => void refresh()}>
        {t('trackingPage.quickRefresh')}
      </button>
      <Link className="pp-btn pp-btn--ghost" to="/pets" style={{ textDecoration: 'none' }}>
        {t('trackingPage.managePets')}
      </Link>
    </div>
  );

  return (
    <div className="pp-feed pp-tracker-page">
      <header className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <span className="pp-publicHero__eyebrow" style={{ display: 'inline-block', width: 'fit-content' }}>
            {t('trackingPage.badgePetpal')}
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
        <section className="pp-card pp-pad" aria-label={selectedPet.name}>
          <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div className="pp-row" style={{ alignItems: 'center', gap: 12 }}>
              <PetAvatar pet={selectedPet} size={56} />
              <div>
                <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
                  {selectedPet.name}
                </h2>
                <p className="pp-subtle" style={{ marginTop: 4, marginBottom: 0 }}>
                  {position?.statusText || (signalLive ? t('trackingPage.signalLive') : t('trackingPage.signalQuiet'))} ·{' '}
                  {lastUpdateLabel}
                </p>
                {signalLive ? (
                  <div style={{ marginTop: 10 }}>
                    <span className={`pp-trackGpsPill ${gpsOkVisual ? 'pp-trackGpsPill--ok' : 'pp-trackGpsPill--warn'}`}>
                      {gpsOkVisual ? `✓ ${t('trackingPage.gpsOk')}` : `⚠ ${t('trackingPage.gpsWeak')}`}
                    </span>
                    <span className="pp-subtle" style={{ marginLeft: 10, fontSize: 13 }}>
                      {t('trackingPage.accuracyLabel', { value: accuracyLabel })}
                      {position?.warningStale ? ` · ${t('trackingPage.warnOffline')}` : ''}
                    </span>
                  </div>
                ) : null}
                {position && accMeter ? (
                  <div
                    className="pp-trackAccuracyMeter"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Number.parseInt(accMeter.width, 10)}
                    aria-label={t('trackingPage.accuracyMeterLabel')}
                  >
                    <div className="pp-trackAccuracyMeter__fill" style={{ width: accMeter.width, background: accMeter.background }} />
                  </div>
                ) : null}
              </div>
            </div>

          </div>

          {position ? (
            <div
              className="pp-trackStatusGrid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 10,
                marginTop: 14,
              }}
            >
              <div className="pp-card" style={{ minWidth: 0, padding: 12, borderRadius: 20 }}>
                <div className="pp-label">{t('trackingPage.cardLocation')}</div>
                <div style={{ marginTop: 6 }}>
                  <span className={`pp-trackGpsPill ${approx ? 'pp-trackGpsPill--warn' : 'pp-trackGpsPill--ok'}`} style={{ fontSize: 12 }}>
                    {approx ? t('trackingPage.badgeApprox') : 'GPS'}
                  </span>
                </div>
                <p className="pp-subtle" style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.35 }}>
                  {position.accuracyText || t(approx ? 'trackingPage.accuracyApprox' : 'trackingPage.accuracyHigh')}
                </p>
              </div>

              <div className="pp-card" style={{ minWidth: 0, padding: 12, borderRadius: 20 }}>
                <div className="pp-label">{t('trackingPage.cardHealth')}</div>
                {batPct != null ? (
                  <div className="pp-batteryBar" aria-label={t('trackingPage.batteryPctAria', { pct: batPct })}>
                    <div className="pp-batteryBar__fill" style={batteryFillStyle(batPct)} />
                    <div className="pp-batteryBar__label">
                      {batPct}% · {position.batteryStatus || t('trackingPage.healthBattery')}
                    </div>
                  </div>
                ) : (
                  <p className="pp-subtle" style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.35 }}>
                    {t('trackingPage.healthBattery')}: —
                  </p>
                )}
                <p className="pp-subtle" style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.35 }}>
                  {t('trackingPage.healthSignal')}: {position.signal != null ? `${position.signal} (${position.signalStatus || '—'})` : '—'}
                </p>
              </div>

              <div className="pp-card" style={{ minWidth: 0, padding: 12, borderRadius: 20 }}>
                <div className="pp-label">{t('trackingPage.cardActivity')}</div>
                <p className="pp-subtle" style={{ marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.35 }}>
                  {t('trackingPage.activitySteps')}: {position.steps ?? '—'}
                </p>
                <p className="pp-subtle" style={{ marginTop: 6, marginBottom: 0, fontSize: 13, lineHeight: 1.35 }}>
                  {position.movementText || (position.isMoving ? t('trackingPage.moving') : t('trackingPage.notMoving'))}
                </p>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="pp-card pp-pad pp-trackMapShell">
        <div className="pp-trackMapHead">
          <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
            {t('trackingPage.sectionMap')}
          </h2>
          {position && hasCoordinates ? (
            <a
              className="pp-btn pp-btn--ghost"
              href={mapsLink(position.lat, position.lng)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              {t('trackingPage.openGoogleMaps')}
            </a>
          ) : null}
        </div>
        {trackingActions}
        {position && hasCoordinates ? (
          <>
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
                {t('trackingPage.lblDeviceTime')}: {deviceTimeLabel}
              </span>
            </div>
          </>
        ) : (
          <div className="pp-trackMapEmpty">
            <p className="pp-subtle" style={{ margin: 0 }}>
              {position ? 'Provider data received, but no GPS coordinates are available yet.' : error || t('trackingPage.mapPlaceholder')}
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
          {imeiDirty && selectedPet ? (
            <div className="pp-trackImeiWarn" role="status">
              {t('trackingPage.imeiChangeWarn', { name: selectedPet.name })}
            </div>
          ) : null}
          {selectedPet ? (
            <p className="pp-subtle pp-trackImeiFoot" style={{ margin: 0 }}>
              {t('trackingPage.persistHintSaving', { name: selectedPet.name })}{' '}
              <Link to="/pets">{t('trackingPage.editImeiOnMyPets')}</Link>
            </p>
          ) : null}
          {!position && error ? <div className="pp-error">{error}</div> : null}
          <button className="pp-btn pp-btnPrimary" type="submit" disabled={loading || !effectiveDeviceId}>
            {loading ? t('trackingPage.btnRefresh') : t('trackingPage.btnSaveLoad')}
          </button>
        </form>
      </section>

      {hasDiagnostics(position) ? (
        <section className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Everything received from provider</h2>
          <p className="pp-subtle" style={{ marginTop: 0 }}>
            Latest raw tracker payload and parsed fields kept by the TCP server.
          </p>
          <pre
            style={{
              margin: 0,
              overflow: 'auto',
              maxHeight: 360,
              padding: 12,
              borderRadius: 12,
              background: '#0f172a',
              color: '#e2e8f0',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {JSON.stringify(position.diagnostics, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
