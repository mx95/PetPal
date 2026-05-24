import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  applyTrackingModePreset,
  applyWifiBssids,
  fetchPendingCommands,
  formatBssidInput,
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

const SIMPLE_MODE_IDS = ['wifi_priority', 'gps_priority'];

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
    const loaded = loadWifiNetworks(imei);
    setNetworks(loaded.length ? loaded : [newWifiNetworkEntry()]);
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
    setNetworks((prev) => (prev.length <= 1 ? prev : prev.filter((n) => n.id !== id)));
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

      await applyTrackingModePreset(imei, modeId);

      if (validBssids.length > 0) {
        await applyWifiBssids(imei, validBssids);
      }

      setStatus(t('trackingPage.devicePanelQueuedSimple'));
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
      setStatus(t('trackingPage.devicePanelQueryQueuedSimple'));
      await refreshPending();
    } catch (err) {
      setError(err?.message || t('trackingPage.devicePanelFailed'));
    } finally {
      setBusy(false);
    }
  }

  const applyLabel =
    modeId === 'wifi_priority'
      ? t('trackingPage.devicePanelApplyHome')
      : t('trackingPage.devicePanelApply');

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
            {SIMPLE_MODE_IDS.map((id) => {
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
                  {id === 'wifi_priority' ? (
                    <span className="pp-trackDeviceMode__badge">{t('trackingPage.deviceModeRecommended')}</span>
                  ) : null}
                  <span className="pp-trackDeviceMode__icon" aria-hidden>
                    <IconTrackSource kind={iconKind} size={22} />
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

        {modeId === 'wifi_priority' ? (
          <div className="pp-trackDeviceWifi pp-trackDeviceWifi--simple">
            <div className="pp-trackDeviceWifi__head">
              <h3>{t('trackingPage.devicePanelWifiTitle')}</h3>
              <p className="pp-subtle">{t('trackingPage.devicePanelWifiHelpSimple')}</p>
            </div>

            <ul className="pp-trackDeviceWifi__list">
              {networks.map((n, index) => {
                const valid = normalizeBssid(n.bssid);
                const showRemove = networks.length > 1;
                return (
                  <li key={n.id} className="pp-trackDeviceWifi__row pp-trackDeviceWifi__row--stacked">
                    <label className="pp-trackDeviceWifi__field">
                      <span>{t('trackingPage.devicePanelWifiLabelPh')}</span>
                      <input
                        className="pp-input"
                        type="text"
                        placeholder={t('trackingPage.devicePanelWifiLabelExample')}
                        value={n.label}
                        onChange={(e) => updateNetwork(n.id, { label: e.target.value })}
                      />
                    </label>
                    <label className="pp-trackDeviceWifi__field">
                      <span>{t('trackingPage.devicePanelWifiRouterCode')}</span>
                      <input
                        className={`pp-input pp-input--mono${n.bssid && !valid ? ' pp-input--invalid' : ''}`}
                        type="text"
                        inputMode="text"
                        placeholder="aa:bb:cc:dd:ee:ff"
                        value={n.bssid}
                        onChange={(e) => updateNetwork(n.id, { bssid: formatBssidInput(e.target.value) })}
                        spellCheck={false}
                        autoComplete="off"
                        aria-invalid={Boolean(n.bssid && !valid)}
                      />
                    </label>
                    {showRemove ? (
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost pp-trackDeviceWifi__remove"
                        onClick={() => removeNetwork(n.id)}
                      >
                        {t('trackingPage.devicePanelWifiRemove')}
                      </button>
                    ) : null}
                    {index === 0 ? (
                      <details className="pp-trackDeviceWifi__help">
                        <summary>{t('trackingPage.devicePanelWifiHelpToggle')}</summary>
                        <ol>
                          <li>{t('trackingPage.devicePanelWifiHelpStep1')}</li>
                          <li>{t('trackingPage.devicePanelWifiHelpStep2')}</li>
                          <li>{t('trackingPage.devicePanelWifiHelpStep3')}</li>
                        </ol>
                        <p className="pp-subtle">{t('trackingPage.devicePanelWifiHelpNote')}</p>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="pp-trackDevicePanel__actions">
          <button
            type="submit"
            className="pp-btn pp-btnPrimary pp-trackDevicePanel__cta"
            disabled={busy || !imei?.trim() || !commandsAvailable}
          >
            {busy ? t('trackingPage.devicePanelApplying') : applyLabel}
          </button>
        </div>

        <details className="pp-trackDevicePanel__advanced">
          <summary>{t('trackingPage.devicePanelAdvanced')}</summary>
          <div className="pp-trackDevicePanel__advancedBody">
            {modeId === 'wifi_priority' ? (
              <button type="button" className="pp-btn pp-btn--ghost" onClick={addNetwork}>
                {t('trackingPage.devicePanelWifiAdd')}
              </button>
            ) : null}

            <label className="pp-trackDevicePanel__gpsOnly">
              <input
                type="checkbox"
                checked={modeId === 'gps_only'}
                onChange={(e) => setModeId(e.target.checked ? 'gps_only' : 'gps_priority')}
              />
              <span>
                <strong>{t('trackingPage.deviceMode_gps_only')}</strong>
                <span className="pp-subtle">{t('trackingPage.deviceMode_gps_only_desc')}</span>
              </span>
            </label>

            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              disabled={busy || !imei?.trim() || !commandsAvailable}
              onClick={() => void handleQuery()}
            >
              {t('trackingPage.devicePanelQuery')}
            </button>
          </div>
        </details>

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
          <div className="pp-trackDevicePanel__pending" role="status">
            {t('trackingPage.devicePanelPendingSimple')}
          </div>
        ) : null}

        <p className="pp-subtle pp-trackDevicePanel__foot">{t('trackingPage.devicePanelFoot')}</p>
      </form>
    </section>
  );
}
