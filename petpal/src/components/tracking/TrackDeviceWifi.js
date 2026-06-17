import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  applyWifiBssids,
  bssidSameRouterFamily,
  formatBssidInput,
  isTrackerCommandsAvailable,
  normalizeBssid,
  pickBestScannedBssid,
} from '../../tracking/trackerCommandClient';
import {
  loadWifiNetworks,
  newWifiNetworkEntry,
  saveWifiNetworks,
} from '../../tracking/wifiNetworkStorage';

/**
 * Home router Wi‑Fi setup — lives on the Device tab (not the Live map).
 * @param {{ imei: string, provider?: string|null, scannedBssids?: string[]|null, onStatus?: (msg: string) => void, onError?: (msg: string) => void }} props
 */
export default function TrackDeviceWifi({
  imei,
  provider = null,
  scannedBssids = null,
  onStatus,
  onError,
}) {
  const { t } = useI18n();
  const commandsAvailable = isTrackerCommandsAvailable();
  const isXexun = provider === 'xexun';
  const isG365 = provider === 'g365';
  const canSendToCollar = isXexun && commandsAvailable;

  const [networks, setNetworks] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!imei) {
      setNetworks([]);
      return;
    }
    const loaded = loadWifiNetworks(imei);
    setNetworks(loaded.length ? loaded : [newWifiNetworkEntry()]);
  }, [imei]);

  const validBssids = useMemo(
    () => networks.map((n) => normalizeBssid(n.bssid)).filter(Boolean),
    [networks]
  );

  const detectedList = useMemo(
    () => (Array.isArray(scannedBssids) ? scannedBssids.map(normalizeBssid).filter(Boolean) : []),
    [scannedBssids]
  );

  const primaryUserBssid = validBssids[0] || null;
  const bssidMismatch = useMemo(() => {
    if (!primaryUserBssid || detectedList.length === 0) return false;
    return !detectedList.some(
      (s) => s === primaryUserBssid || bssidSameRouterFamily(primaryUserBssid, s)
    );
  }, [primaryUserBssid, detectedList]);

  const suggestedBssid = useMemo(
    () => pickBestScannedBssid(primaryUserBssid || '', detectedList),
    [primaryUserBssid, detectedList]
  );

  const applySuggestedBssid = useCallback(() => {
    if (!suggestedBssid || networks.length === 0) return;
    const firstId = networks[0].id;
    setNetworks((prev) =>
      prev.map((n, i) => (i === 0 || n.id === firstId ? { ...n, bssid: suggestedBssid } : n))
    );
  }, [suggestedBssid, networks]);

  function updateNetwork(id, patch) {
    setNetworks((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function removeNetwork(id) {
    setNetworks((prev) => (prev.length <= 1 ? prev : prev.filter((n) => n.id !== id)));
  }

  function addNetwork() {
    setNetworks((prev) => [...prev, newWifiNetworkEntry()]);
  }

  async function handleSave(e) {
    e.preventDefault();
    onError?.('');
    onStatus?.('');

    if (!imei?.trim()) {
      onError?.(t('trackingPage.devicePanelNeedImei'));
      return;
    }
    if (validBssids.length === 0) {
      onError?.(t('trackingPage.devicePanelNeedWifi'));
      return;
    }
    if (canSendToCollar && !commandsAvailable) {
      onError?.(t('trackingPage.devicePanelNoApi'));
      return;
    }

    setBusy(true);
    try {
      saveWifiNetworks(imei, networks);
      if (canSendToCollar) {
        await applyWifiBssids(imei, validBssids);
        onStatus?.(t('trackingPage.devicePanelQueuedSimple'));
      } else {
        onStatus?.(t('trackingPage.devicePanelWifiSavedLocal'));
      }
    } catch (err) {
      if (err?.code === 'TRACKER_API_NOT_CONFIGURED') {
        onError?.(t('trackingPage.devicePanelNoApi'));
      } else {
        onError?.(err?.message || t('trackingPage.devicePanelFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isXexun && !isG365) return null;

  return (
    <fieldset className="pp-trackDeviceG365Group">
      <legend className="pp-trackDeviceModes__legend">{t('trackingPage.devicePanelWifiTitle')}</legend>
      <form className="pp-trackDeviceWifi pp-trackDeviceWifi--simple" onSubmit={(ev) => void handleSave(ev)}>
        <p className="pp-subtle">{t('trackingPage.devicePanelWifiHelpSimple')}</p>
        {isG365 ? (
          <p className="pp-subtle pp-trackDevicePanel__foot">{t('trackingPage.devicePanelG365WifiHint')}</p>
        ) : null}

        {detectedList.length > 0 ? (
          <div className="pp-trackDeviceWifi__detected" role="status">
            <p className="pp-trackDeviceWifi__detectedTitle">{t('trackingPage.devicePanelWifiDetectedTitle')}</p>
            <ul className="pp-trackDeviceWifi__detectedList">
              {detectedList.map((mac) => (
                <li key={mac}>
                  <code>{mac}</code>
                  {primaryUserBssid && bssidSameRouterFamily(primaryUserBssid, mac) && mac !== primaryUserBssid ? (
                    <span className="pp-trackDeviceWifi__detectedTag">{t('trackingPage.devicePanelWifiDetectedMatch')}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {bssidMismatch && suggestedBssid ? (
              <div className="pp-trackDeviceWifi__detectedFix">
                <p className="pp-subtle">{t('trackingPage.devicePanelWifiDetectedMismatch')}</p>
                <button type="button" className="pp-btn pp-btn--ghost" onClick={applySuggestedBssid}>
                  {t('trackingPage.devicePanelWifiUseDetected', { bssid: suggestedBssid })}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <ul className="pp-trackDeviceWifi__list">
          {networks.map((n) => {
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
                <details className="pp-trackDeviceWifi__help">
                  <summary>{t('trackingPage.devicePanelWifiHelpToggle')}</summary>
                  <ol>
                    <li>{t('trackingPage.devicePanelWifiHelpStep1')}</li>
                    <li>{t('trackingPage.devicePanelWifiHelpStep2')}</li>
                    <li>{t('trackingPage.devicePanelWifiHelpStep3')}</li>
                  </ol>
                  <p className="pp-subtle">{t('trackingPage.devicePanelWifiHelpNote')}</p>
                </details>
              </li>
            );
          })}
        </ul>

        <div className="pp-trackDevicePanel__actions">
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            disabled={busy}
            onClick={addNetwork}
          >
            {t('trackingPage.devicePanelWifiAdd')}
          </button>
          <button
            type="submit"
            className="pp-btn pp-btnPrimary"
            disabled={busy || !imei?.trim() || (canSendToCollar && !commandsAvailable)}
          >
            {busy ? t('trackingPage.devicePanelApplying') : t('trackingPage.devicePanelWifiSave')}
          </button>
        </div>
      </form>
    </fieldset>
  );
}
