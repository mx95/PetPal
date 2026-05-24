import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { TRACKING_MODE_PRESETS } from '../../tracking/trackingModePresets';
import {
  applyTrackingModePreset,
  applyWifiBssids,
  fetchPendingCommands,
  isTrackerCommandsAvailable,
  normalizeBssid,
  queryTrackingMode,
  queryWifiBssids,
} from '../../tracking/trackerCommandClient';
import {
  loadWifiNetworks,
  newWifiNetworkEntry,
  saveWifiNetworks,
} from '../../tracking/wifiNetworkStorage';
import IconTrackSource from '../icons/IconTrackSource';

const MODE_IDS = ['wifi_priority', 'gps_priority', 'gps_only'];

/**
 * @param {{ imei: string, petName?: string }} props
 */
export default function TrackDevicePanel({ imei, petName = '' }) {
  const { t } = useI18n();
  const commandsAvailable = isTrackerCommandsAvailable();

  const [modeId, setModeId] = useState('wifi_priority');
  const [networks, setNetworks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState([]);

  useEffect(() => {
    if (!imei) {
      setNetworks([]);
      return;
    }
    setNetworks(loadWifiNetworks(imei));
    setModeId('wifi_priority');
    setStatus('');
    setError('');
  }, [imei]);

  const validBssids = useMemo(
    () => networks.map((n) => normalizeBssid(n.bssid)).filter(Boolean),
    [networks]
  );

  const refreshPending = useCallback(async () => {
    if (!imei || !commandsAvailable) return;
    try {
      const data = await fetchPendingCommands(imei);
      setPending(Array.isArray(data?.pending) ? data.pending : []);
    } catch {
      setPending([]);
    }
  }, [imei, commandsAvailable]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  function updateNetwork(id, patch) {
    setNetworks((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function removeNetwork(id) {
    setNetworks((prev) => prev.filter((n) => n.id !== id));
  }

  function addNetwork() {
    setNetworks((prev) => [...prev, newWifiNetworkEntry()]);
  }

  async function handleApply(e) {
    e.preventDefault();
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
    if (modeId === 'wifi_priority' && validBssids.length === 0) {
      setError(t('trackingPage.devicePanelNeedWifi'));
      return;
    }

    setBusy(true);
    try {
      saveWifiNetworks(imei, networks);

      const results = [];
      const modeRes = await applyTrackingModePreset(imei, modeId);
      results.push(modeRes?.command || 'tk=…');

      if (validBssids.length > 0) {
        const wifiRes = await applyWifiBssids(imei, validBssids);
        results.push(wifiRes?.command || 'wifi=…');
      }

      setStatus(t('trackingPage.devicePanelQueued', { commands: results.join(' · ') }));
      await refreshPending();
    } catch (err) {
      if (err?.code === 'TRACKER_API_NOT_CONFIGURED') {
        setError(t('trackingPage.devicePanelNoApi'));
      } else {
        setError(err?.message || t('trackingPage.devicePanelFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleQuery() {
    if (!imei?.trim() || !commandsAvailable) return;
    setBusy(true);
    setError('');
    try {
      await queryTrackingMode(imei);
      await queryWifiBssids(imei);
      setStatus(t('trackingPage.devicePanelQueryQueued'));
      await refreshPending();
    } catch (err) {
      setError(err?.message || t('trackingPage.devicePanelFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pp-trackDevicePanel" aria-labelledby="pp-trackDevicePanel-title">
      <h2 id="pp-trackDevicePanel-title" className="pp-sectionTitle">
        {t('trackingPage.devicePanelTitle')}
      </h2>
      <p className="pp-subtle pp-trackDevicePanel__intro">
        {petName
          ? t('trackingPage.devicePanelIntroNamed', { name: petName })
          : t('trackingPage.devicePanelIntro')}
      </p>

      {!commandsAvailable ? (
        <div className="pp-trackDevicePanel__warn" role="status">
          {t('trackingPage.devicePanelNoApi')}
        </div>
      ) : null}

      <form className="pp-trackDevicePanel__form" onSubmit={handleApply}>
        <fieldset className="pp-trackDeviceModes">
          <legend className="pp-trackDeviceModes__legend">{t('trackingPage.devicePanelModeLegend')}</legend>
          <div className="pp-trackDeviceModes__grid">
            {MODE_IDS.map((id) => {
              const preset = TRACKING_MODE_PRESETS.find((p) => p.id === id);
              const active = modeId === id;
              const iconKind = id === 'wifi_priority' ? 'wifi' : 'gps';
              return (
                <label key={id} className={`pp-trackDeviceMode${active ? ' is-active' : ''}`}>
                  <input
                    type="radio"
                    name="trackingMode"
                    value={id}
                    checked={active}
                    onChange={() => setModeId(id)}
                  />
                  <span className="pp-trackDeviceMode__icon" aria-hidden>
                    <IconTrackSource kind={iconKind} size={18} />
                  </span>
                  <span className="pp-trackDeviceMode__copy">
                    <strong>{t(`trackingPage.deviceMode_${id}`)}</strong>
                    <span>{t(`trackingPage.deviceMode_${id}_desc`)}</span>
                    {preset ? (
                      <span className="pp-trackDeviceMode__meta">
                        {t('trackingPage.deviceModeTkHint', { p1: preset.p1 })}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="pp-trackDeviceWifi">
          <div className="pp-trackDeviceWifi__head">
            <h3>{t('trackingPage.devicePanelWifiTitle')}</h3>
            <p className="pp-subtle">{t('trackingPage.devicePanelWifiHelp')}</p>
          </div>

          {networks.length === 0 ? (
            <p className="pp-subtle pp-trackDeviceWifi__empty">{t('trackingPage.devicePanelWifiEmpty')}</p>
          ) : (
            <ul className="pp-trackDeviceWifi__list">
              {networks.map((n) => {
                const valid = normalizeBssid(n.bssid);
                return (
                  <li key={n.id} className="pp-trackDeviceWifi__row">
                    <input
                      className="pp-input"
                      type="text"
                      placeholder={t('trackingPage.devicePanelWifiLabelPh')}
                      value={n.label}
                      onChange={(e) => updateNetwork(n.id, { label: e.target.value })}
                      aria-label={t('trackingPage.devicePanelWifiLabelPh')}
                    />
                    <input
                      className={`pp-input${n.bssid && !valid ? ' pp-input--invalid' : ''}`}
                      type="text"
                      placeholder={t('trackingPage.devicePanelWifiBssidPh')}
                      value={n.bssid}
                      onChange={(e) => updateNetwork(n.id, { bssid: e.target.value })}
                      aria-label={t('trackingPage.devicePanelWifiBssidPh')}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="pp-btn pp-btn--ghost pp-trackDeviceWifi__remove"
                      onClick={() => removeNetwork(n.id)}
                      aria-label={t('trackingPage.devicePanelWifiRemove')}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button type="button" className="pp-btn pp-btn--ghost" onClick={addNetwork}>
            {t('trackingPage.devicePanelWifiAdd')}
          </button>
        </div>

        <div className="pp-trackDevicePanel__actions">
          <button type="submit" className="pp-btn pp-btnPrimary" disabled={busy || !imei?.trim() || !commandsAvailable}>
            {busy ? t('trackingPage.devicePanelApplying') : t('trackingPage.devicePanelApply')}
          </button>
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            disabled={busy || !imei?.trim() || !commandsAvailable}
            onClick={() => void handleQuery()}
          >
            {t('trackingPage.devicePanelQuery')}
          </button>
        </div>

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

        {pending.length > 0 ? (
          <div className="pp-trackDevicePanel__pending">
            <strong>{t('trackingPage.devicePanelPending')}</strong>
            <ul>
              {pending.map((cmd, i) => (
                <li key={`${cmd}-${i}`}>
                  <code>{cmd}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="pp-subtle pp-trackDevicePanel__foot">{t('trackingPage.devicePanelFoot')}</p>
      </form>
    </section>
  );
}
