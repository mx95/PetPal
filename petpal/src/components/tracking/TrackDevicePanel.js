import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  requestG365ManualPosition,
  restartG365,
  setG365StatusInterval,
  setG365UploadInterval,
  startG365Find,
} from '../../tracking/g365CommandClient';
import {
  applyTrackingModePreset,
  applyXexunBatteryPlan,
  fetchPendingCommands,
  isTrackerCommandsAvailable,
  queryTrackingMode,
} from '../../tracking/trackerCommandClient';
import {
  isGpsposSyncAvailable,
  syncGpsposPosition,
} from '../../tracking/gpsposCommandClient';
import IconTrackSource from '../icons/IconTrackSource';
import { resolveTrackerHttpBase } from '../../tracking/trackingWifiFeature';

const XEXUN_ADVANCED_MODES = ['gps_only'];

const G365_UPLOAD_PRESETS = [
  { id: '60', seconds: 60 },
  { id: '180', seconds: 180 },
  { id: '300', seconds: 300 },
  { id: '600', seconds: 600 },
];

const G365_STATUS_PRESETS = [
  { id: '3', minutes: 3 },
  { id: '5', minutes: 5 },
  { id: '10', minutes: 10 },
];

/** User-facing plans — maps to upload + status intervals on 365GPS collars. */
const BATTERY_PLANS = [
  { id: 'long_life', uploadSeconds: 600, statusMinutes: 10, batteryTier: 5 },
  { id: 'balanced', uploadSeconds: 300, statusMinutes: 5, batteryTier: 4, recommended: true },
  { id: 'regular', uploadSeconds: 180, statusMinutes: 5, batteryTier: 3 },
  { id: 'active', uploadSeconds: 60, statusMinutes: 3, batteryTier: 2 },
];

function findBatteryPlan(uploadSeconds, statusMinutes) {
  return BATTERY_PLANS.find(
    (p) => p.uploadSeconds === uploadSeconds && p.statusMinutes === statusMinutes
  );
}

function normalizeProvider(value) {
  if (value === 'g365' || value === 'xexun' || value === 'gpspos') return value;
  return null;
}

async function fetchDeviceProvider(imei) {
  const base = resolveTrackerHttpBase();
  if (!base || !imei?.trim()) return null;
  const path = `/api/app/devices/${encodeURIComponent(String(imei).trim())}`;
  const url = base === '' ? path : `${base}${path}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeProvider(data?.provider);
  } catch {
    return null;
  }
}

function commandErrorMessage(err, t) {
  if (err?.code === 'TRACKER_API_NOT_CONFIGURED') return t('trackingPage.devicePanelNoApi');
  if (err?.code === 'device_offline') return t('trackingPage.devicePanelG365Offline');
  if (err?.code === 'gpspos_disabled') return t('trackingPage.devicePanelGpsposDisabled');
  if (err?.code === 'no_position') return t('trackingPage.devicePanelGpsposNoPosition');
  return err?.message || t('trackingPage.devicePanelFailed');
}

function BatteryUseMeter({ tier, label }) {
  return (
    <span className="pp-trackDeviceBattery" aria-label={label}>
      <span className="pp-trackDeviceBattery__label">{label}</span>
      <span className="pp-trackDeviceBattery__bars" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`pp-trackDeviceBattery__bar${n <= tier ? ' is-on' : ''}`}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * @param {{ imei: string, petName?: string, provider?: string|null }} props
 */
export default function TrackDevicePanel({ imei, petName = '', provider = null }) {
  const { t } = useI18n();
  const commandsAvailable = isTrackerCommandsAvailable();
  const propProvider = normalizeProvider(provider);

  const [resolvedProvider, setResolvedProvider] = useState(propProvider);
  const [modeId, setModeId] = useState('gps_only');
  const [planId, setPlanId] = useState('balanced');
  const [uploadSeconds, setUploadSeconds] = useState(300);
  const [statusMinutes, setStatusMinutes] = useState(5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState([]);

  const isGpspos = resolvedProvider === 'gpspos';
  const isG365 = resolvedProvider === 'g365';
  const isXexun = resolvedProvider === 'xexun';
  const activePlan = useMemo(
    () => findBatteryPlan(uploadSeconds, statusMinutes),
    [uploadSeconds, statusMinutes]
  );

  useEffect(() => {
    setResolvedProvider(propProvider);
  }, [propProvider]);

  useEffect(() => {
    if (propProvider || !imei?.trim()) return;
    let cancelled = false;
    void fetchDeviceProvider(imei).then((next) => {
      if (!cancelled && next) setResolvedProvider(next);
    });
    return () => {
      cancelled = true;
    };
  }, [propProvider, imei]);

  const refreshPending = useCallback(async () => {
    if (!imei || !commandsAvailable || !isXexun) return;
    try {
      const data = await fetchPendingCommands(imei);
      setPending(Array.isArray(data?.pending) ? data.pending : []);
    } catch {
      setPending([]);
    }
  }, [imei, commandsAvailable, isXexun]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    setPlanId('balanced');
    setUploadSeconds(300);
    setStatusMinutes(5);
    setModeId('gps_only');
    setStatus('');
    setError('');
  }, [imei, resolvedProvider]);

  function selectBatteryPlan(id) {
    const plan = BATTERY_PLANS.find((p) => p.id === id);
    if (!plan) return;
    setPlanId(id);
    setUploadSeconds(plan.uploadSeconds);
    setStatusMinutes(plan.statusMinutes);
  }

  function handleAdvancedUpload(seconds) {
    setUploadSeconds(seconds);
    const match = findBatteryPlan(seconds, statusMinutes);
    setPlanId(match?.id ?? 'custom');
  }

  function handleAdvancedStatus(minutes) {
    setStatusMinutes(minutes);
    const match = findBatteryPlan(uploadSeconds, minutes);
    setPlanId(match?.id ?? 'custom');
  }

  async function runCommand(fn) {
    setError('');
    setStatus('');
    if (!imei?.trim()) {
      setError(t('trackingPage.devicePanelNeedImei'));
      return;
    }
    if (!commandsAvailable) {
      setError(t('trackingPage.devicePanelNoApi'));
      return;
    }
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(commandErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function resolveProviderForSave() {
    if (resolvedProvider === 'g365' || resolvedProvider === 'xexun' || resolvedProvider === 'gpspos') {
      return resolvedProvider;
    }
    const fetched = await fetchDeviceProvider(imei);
    if (fetched) {
      setResolvedProvider(fetched);
      return fetched;
    }
    return 'g365';
  }

  async function handleGpsposSync() {
    await runCommand(async () => {
      await syncGpsposPosition(imei);
      setStatus(t('trackingPage.devicePanelGpsposSynced'));
    });
  }

  async function handleSavePlan(e) {
    e.preventDefault();
    await runCommand(async () => {
      const collarProvider = await resolveProviderForSave();
      const selectedPlanId = activePlan?.id ?? planId;
      if (collarProvider === 'xexun') {
        await applyXexunBatteryPlan(imei, selectedPlanId);
        await refreshPending();
      } else {
        await setG365UploadInterval(imei, uploadSeconds);
        await setG365StatusInterval(imei, statusMinutes);
      }
      setStatus(t('trackingPage.devicePanelPresetSaved'));
    });
  }

  async function handleXexunQuery() {
    await runCommand(async () => {
      await queryTrackingMode(imei);
      setStatus(t('trackingPage.devicePanelQueryQueuedSimple'));
      await refreshPending();
    });
  }

  async function handleXexunAdvancedApply() {
    await runCommand(async () => {
      await applyTrackingModePreset(imei, modeId);
      setStatus(t('trackingPage.devicePanelQueuedSimple'));
      await refreshPending();
    });
  }

  return (
    <section className="pp-trackDevicePanel" aria-label={t('trackingPage.devicePanelBatteryLegend')}>
      {!commandsAvailable && !isGpsposSyncAvailable() ? (
        <div className="pp-trackDevicePanel__warn" role="status">
          {t('trackingPage.devicePanelNoApi')}
        </div>
      ) : null}

      {isGpspos ? (
        <div className="pp-trackDevicePanel__cloud">
          <p className="pp-subtle">{t('trackingPage.devicePanelGpsposIntro')}</p>
          <button
            type="button"
            className="pp-btn pp-btnPrimary pp-trackDevicePanel__cta"
            disabled={busy || !imei?.trim() || !isGpsposSyncAvailable()}
            onClick={() => void handleGpsposSync()}
          >
            {busy ? t('trackingPage.devicePanelGpsposSyncing') : t('trackingPage.devicePanelGpsposSync')}
          </button>
          <p className="pp-subtle pp-trackDevicePanel__foot">{t('trackingPage.devicePanelGpsposFoot')}</p>
        </div>
      ) : (
      <form className="pp-trackDevicePanel__form" onSubmit={(e) => void handleSavePlan(e)}>
        <fieldset className="pp-trackDeviceModes">
          <legend className="pp-trackDeviceModes__legend">{t('trackingPage.devicePanelBatteryLegend')}</legend>
          <div className="pp-trackDeviceModes__grid pp-trackDeviceModes__grid--plans">
            {BATTERY_PLANS.map((plan) => {
              const selected =
                planId === plan.id || (planId === 'custom' && activePlan?.id === plan.id);
              return (
                <label
                  key={plan.id}
                  className={`pp-trackDeviceMode pp-trackDevicePlan${selected ? ' is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="batteryPlan"
                    checked={selected}
                    onChange={() => selectBatteryPlan(plan.id)}
                  />
                  {plan.recommended ? (
                    <span className="pp-trackDeviceMode__badge">
                      {t('trackingPage.devicePanelBatteryRecommended')}
                    </span>
                  ) : null}
                  <span className="pp-trackDeviceMode__copy">
                    <strong>{t(`trackingPage.devicePanelPlan_${plan.id}`)}</strong>
                    <span>{t(`trackingPage.devicePanelPlan_${plan.id}_desc`)}</span>
                    <BatteryUseMeter
                      tier={plan.batteryTier}
                      label={t(`trackingPage.devicePanelBatteryTier_${plan.batteryTier}`)}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="pp-trackDevicePanel__actions">
          <button
            type="submit"
            className="pp-btn pp-btnPrimary pp-trackDevicePanel__cta"
            disabled={busy || !imei?.trim() || !commandsAvailable}
          >
            {busy ? t('trackingPage.devicePanelApplying') : t('trackingPage.devicePanelApplyPreset')}
          </button>
        </div>

        {isG365 ? (
          <fieldset className="pp-trackDeviceG365Group">
            <legend className="pp-trackDeviceModes__legend">{t('trackingPage.devicePanelQuickLegend')}</legend>
            <div className="pp-trackDeviceG365Actions">
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                disabled={busy || !imei?.trim() || !commandsAvailable}
                onClick={() =>
                  void runCommand(async () => {
                    await requestG365ManualPosition(imei, 'gps');
                    setStatus(t('trackingPage.devicePanelG365LocateSent'));
                  })
                }
              >
                {t('trackingPage.devicePanelG365Locate')}
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                disabled={busy || !imei?.trim() || !commandsAvailable}
                onClick={() =>
                  void runCommand(async () => {
                    await startG365Find(imei);
                    setStatus(t('trackingPage.devicePanelG365FindSent'));
                  })
                }
              >
                {t('trackingPage.devicePanelG365Find')}
              </button>
            </div>
          </fieldset>
        ) : null}

        <details className="pp-trackDevicePanel__advanced">
          <summary>{t('trackingPage.devicePanelAdvanced')}</summary>
          <div className="pp-trackDevicePanel__advancedBody">
            {isG365 ? (
              <>
                <p className="pp-subtle">{t('trackingPage.devicePanelAdvancedIntervalsHint')}</p>

                <fieldset className="pp-trackDeviceG365Group">
                  <legend className="pp-trackDeviceModes__legend">
                    {t('trackingPage.devicePanelG365UploadLegend')}
                  </legend>
                  <div className="pp-trackDeviceG365Presets">
                    {G365_UPLOAD_PRESETS.map(({ id, seconds }) => (
                      <label
                        key={id}
                        className={`pp-trackDeviceG365Preset${uploadSeconds === seconds ? ' is-active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="g365Upload"
                          checked={uploadSeconds === seconds}
                          onChange={() => handleAdvancedUpload(seconds)}
                        />
                        {t(`trackingPage.devicePanelG365Upload_${id}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="pp-trackDeviceG365Group">
                  <legend className="pp-trackDeviceModes__legend">
                    {t('trackingPage.devicePanelG365StatusLegend')}
                  </legend>
                  <div className="pp-trackDeviceG365Presets">
                    {G365_STATUS_PRESETS.map(({ id, minutes }) => (
                      <label
                        key={id}
                        className={`pp-trackDeviceG365Preset${statusMinutes === minutes ? ' is-active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="g365Status"
                          checked={statusMinutes === minutes}
                          onChange={() => handleAdvancedStatus(minutes)}
                        />
                        {t(`trackingPage.devicePanelG365Status_${id}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  className="pp-btn pp-btn--ghost"
                  disabled={busy || !imei?.trim() || !commandsAvailable}
                  onClick={() =>
                    void runCommand(async () => {
                      await restartG365(imei);
                      setStatus(t('trackingPage.devicePanelG365RestartSent'));
                    })
                  }
                >
                  {t('trackingPage.devicePanelG365Restart')}
                </button>

                <p className="pp-subtle pp-trackDevicePanel__foot">{t('trackingPage.devicePanelG365Foot')}</p>
              </>
            ) : (
              <>
                <p className="pp-subtle">{t('trackingPage.devicePanelAdvancedTrackingHint')}</p>
                <fieldset className="pp-trackDeviceModes pp-trackDeviceModes--compact">
                  <legend className="pp-trackDeviceModes__legend">{t('trackingPage.devicePanelModeLegend')}</legend>
                  <div className="pp-trackDeviceModes__grid">
                    {XEXUN_ADVANCED_MODES.map((id) => {
                      const active = modeId === id;
                      return (
                        <label key={id} className={`pp-trackDeviceMode${active ? ' is-active' : ''}`}>
                          <input
                            type="radio"
                            name="trackingModeAdvanced"
                            value={id}
                            checked={active}
                            onChange={() => setModeId(id)}
                          />
                          <span className="pp-trackDeviceMode__icon" aria-hidden>
                            <IconTrackSource kind="gps" size={22} />
                          </span>
                          <span className="pp-trackDeviceMode__copy">
                            <strong>{t(`trackingPage.deviceMode_${id}`)}</strong>
                            <span>{t(`trackingPage.deviceMode_${id}_desc`)}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <button
                  type="button"
                  className="pp-btn pp-btn--ghost"
                  disabled={busy || !imei?.trim() || !commandsAvailable}
                  onClick={() => void handleXexunAdvancedApply()}
                >
                  {t('trackingPage.devicePanelApply')}
                </button>

                <button
                  type="button"
                  className="pp-btn pp-btn--ghost"
                  disabled={busy || !imei?.trim() || !commandsAvailable}
                  onClick={() => void handleXexunQuery()}
                >
                  {t('trackingPage.devicePanelQuery')}
                </button>

                {pending.length > 0 ? (
                  <div className="pp-trackDevicePanel__pending" role="status">
                    {t('trackingPage.devicePanelPendingSimple')}
                  </div>
                ) : null}

                <p className="pp-subtle pp-trackDevicePanel__foot">{t('trackingPage.devicePanelXexunFoot')}</p>
              </>
            )}
          </div>
        </details>
      </form>
      )}

      {status ? (
        <p className="pp-trackDevicePanel__status" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="pp-error pp-trackDevicePanel__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
