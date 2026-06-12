import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  requestG365ManualPosition,
  setG365StatusInterval,
  setG365UploadInterval,
  startG365Find,
} from '../../tracking/g365CommandClient';
import {
  applyXexunBatteryPlan,
  isTrackerCommandsAvailable,
} from '../../tracking/trackerCommandClient';
import {
  isGpsposSyncAvailable,
  saveGpsposBatteryPlan,
  syncGpsposPosition,
} from '../../tracking/gpsposCommandClient';
import { fetchDeviceMeta, normalizeProvider } from '../../tracking/deviceMetaClient';

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

function findBatteryPlanByUpload(uploadSeconds) {
  const n = Number(uploadSeconds);
  if (!Number.isFinite(n)) return null;
  return BATTERY_PLANS.find((p) => p.uploadSeconds === n) ?? null;
}

function formatPollInterval(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.round(n / 60)} min`;
  return `${Math.round(n / 3600)} h`;
}

function commandErrorMessage(err, t) {
  if (err?.code === 'TRACKER_API_NOT_CONFIGURED') return t('trackingPage.devicePanelNoApi');
  if (err?.code === 'device_offline') return t('trackingPage.devicePanelG365Offline');
  if (err?.code === 'gpspos_disabled') return t('trackingPage.devicePanelGpsposDisabled');
  if (err?.code === 'no_position') return t('trackingPage.devicePanelGpsposNoPosition');
  if (err?.code === 'unknown_provider') return t('trackingPage.devicePanelUnknownProvider');
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
  const [deviceConfig, setDeviceConfig] = useState(null);
  const [planId, setPlanId] = useState('balanced');
  const [uploadSeconds, setUploadSeconds] = useState(300);
  const [statusMinutes, setStatusMinutes] = useState(5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const isGpspos = resolvedProvider === 'gpspos';
  const isG365 = resolvedProvider === 'g365';
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
    void fetchDeviceMeta(imei).then((meta) => {
      if (cancelled || !meta) return;
      if (meta.provider) setResolvedProvider(meta.provider);
      if (meta.deviceConfig) setDeviceConfig(meta.deviceConfig);
    });
    return () => {
      cancelled = true;
    };
  }, [propProvider, imei]);

  useEffect(() => {
    if (!isGpspos || !imei?.trim()) return;
    let cancelled = false;
    void fetchDeviceMeta(imei).then((meta) => {
      if (!cancelled && meta?.deviceConfig) setDeviceConfig(meta.deviceConfig);
    });
    return () => {
      cancelled = true;
    };
  }, [isGpspos, imei]);

  useEffect(() => {
    if (!isGpspos || !deviceConfig?.gpsposPollIntervalSec) return;
    const plan = findBatteryPlanByUpload(deviceConfig.gpsposPollIntervalSec);
    if (!plan) return;
    setPlanId(plan.id);
    setUploadSeconds(plan.uploadSeconds);
    setStatusMinutes(plan.statusMinutes);
  }, [isGpspos, deviceConfig?.gpsposPollIntervalSec]);

  useEffect(() => {
    setPlanId('balanced');
    setUploadSeconds(300);
    setStatusMinutes(5);
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
    const fetched = await fetchDeviceMeta(imei);
    if (fetched?.provider) {
      setResolvedProvider(fetched.provider);
      return fetched.provider;
    }
    return null;
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
      if (collarProvider === 'gpspos') {
        await saveGpsposBatteryPlan(imei, {
          planId: selectedPlanId,
          gpsposPollIntervalSec: uploadSeconds,
        });
        await syncGpsposPosition(imei);
        const meta = await fetchDeviceMeta(imei);
        if (meta?.deviceConfig) setDeviceConfig(meta.deviceConfig);
        setStatus(t('trackingPage.devicePanelGpsposSynced'));
        return;
      }
      if (!collarProvider) {
        const err = new Error(t('trackingPage.devicePanelUnknownProvider'));
        err.code = 'unknown_provider';
        throw err;
      }
      if (collarProvider === 'xexun') {
        await applyXexunBatteryPlan(imei, selectedPlanId);
      } else {
        await setG365UploadInterval(imei, uploadSeconds);
        await setG365StatusInterval(imei, statusMinutes);
      }
      setStatus(t('trackingPage.devicePanelPresetSaved'));
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
        <p className="pp-subtle">{t('trackingPage.devicePanelGpsposIntro')}</p>
      ) : null}

      <form className="pp-trackDevicePanel__form" onSubmit={(e) => void handleSavePlan(e)}>
        <fieldset className="pp-trackDeviceModes">
          <legend className="pp-trackDeviceModes__legend">
            {isGpspos
              ? t('trackingPage.devicePanelGpsposPlanLegend')
              : t('trackingPage.devicePanelBatteryLegend')}
          </legend>
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
            disabled={busy || !imei?.trim() || (!isGpspos && !commandsAvailable)}
          >
            {busy
              ? isGpspos
                ? t('trackingPage.devicePanelGpsposSyncing')
                : t('trackingPage.devicePanelApplying')
              : isGpspos
                ? t('trackingPage.devicePanelGpsposApplyPlan')
                : t('trackingPage.devicePanelApplyPreset')}
          </button>
          {isGpspos ? (
            <button
              type="button"
              className="pp-btn pp-btn--ghost pp-trackDevicePanel__cta"
              disabled={busy || !imei?.trim() || !isGpsposSyncAvailable()}
              onClick={() => void handleGpsposSync()}
            >
              {busy ? t('trackingPage.devicePanelGpsposSyncing') : t('trackingPage.devicePanelGpsposSync')}
            </button>
          ) : null}
        </div>

        {isGpspos ? (
          <div className="pp-trackDevicePanel__cloud">
            {deviceConfig?.gpsposPollEnabled && deviceConfig?.gpsposPollIntervalSec ? (
              <p className="pp-subtle">
                {t('trackingPage.devicePanelGpsposPollActive', {
                  interval: formatPollInterval(deviceConfig.gpsposPollIntervalSec),
                })}
              </p>
            ) : (
              <p className="pp-subtle">{t('trackingPage.devicePanelGpsposPollManual')}</p>
            )}
            <p className="pp-subtle pp-trackDevicePanel__foot">{t('trackingPage.devicePanelGpsposFoot')}</p>
          </div>
        ) : null}

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
      </form>

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
