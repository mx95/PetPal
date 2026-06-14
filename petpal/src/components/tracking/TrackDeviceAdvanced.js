import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  requestG365ManualPosition,
  restartG365,
  startG365Find,
} from '../../tracking/g365CommandClient';
import { isTrackerCommandsAvailable } from '../../tracking/trackerCommandClient';
import { getTrackerCapabilities } from '../../tracking/trackerCapabilities';

function CapabilityList({ title, items, t }) {
  if (!items?.length) return null;
  return (
    <div className="pp-trackDeviceAdvanced__block">
      <h4 className="pp-trackDeviceAdvanced__heading">{title}</h4>
      <ul className="pp-trackDeviceAdvanced__list">
        {items.map((item) => (
          <li key={item.id}>
            <span className="pp-trackDeviceAdvanced__itemLabel">{t(item.labelKey)}</span>
            {item.inApp ? (
              <span className="pp-trackDeviceAdvanced__badge pp-trackDeviceAdvanced__badge--app">
                {t('trackingPage.capInApp')}
              </span>
            ) : item.api ? (
              <span className="pp-trackDeviceAdvanced__badge">{t('trackingPage.capApiOnly')}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * @param {{ imei: string, provider: 'g365'|'gpspos'|null, onStatus?: (msg: string) => void, onError?: (msg: string) => void }} props
 */
export default function TrackDeviceAdvanced({ imei, provider, onStatus, onError }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const caps = getTrackerCapabilities(provider);
  const commandsAvailable = isTrackerCommandsAvailable();

  if (!caps) return null;

  async function run(fn, okKey) {
    if (!imei?.trim()) return;
    if (!commandsAvailable && provider === 'g365') {
      onError?.(t('trackingPage.devicePanelNoApi'));
      return;
    }
    setBusy(true);
    onError?.('');
    try {
      await fn();
      onStatus?.(t(okKey));
    } catch (err) {
      onError?.(err?.message || t('trackingPage.devicePanelFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      className="pp-trackDeviceAdvanced"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="pp-trackDeviceAdvanced__summary">{t('trackingPage.deviceAdvancedLegend')}</summary>

      <div className="pp-trackDeviceAdvanced__body">
        <p className="pp-subtle">{t(caps.descKey)}</p>
        <p className="pp-trackDeviceAdvanced__connection">
          <strong>{t('trackingPage.capConnection')}:</strong> {caps.connection}
        </p>

        <CapabilityList title={t('trackingPage.capUplink')} items={caps.uplink} t={t} />
        <CapabilityList title={t('trackingPage.capDownlink')} items={caps.downlink} t={t} />

        {caps.notSupported?.length ? (
          <div className="pp-trackDeviceAdvanced__block">
            <h4 className="pp-trackDeviceAdvanced__heading">{t('trackingPage.capNotSupported')}</h4>
            <ul className="pp-trackDeviceAdvanced__list pp-trackDeviceAdvanced__list--muted">
              {caps.notSupported.map((item) => (
                <li key={item.id}>{t(item.labelKey)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {provider === 'g365' ? (
          <fieldset className="pp-trackDeviceAdvanced__actions">
            <legend className="pp-trackDeviceAdvanced__heading">{t('trackingPage.capExtraActions')}</legend>
            <div className="pp-trackDeviceG365Actions">
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                disabled={busy || !commandsAvailable}
                onClick={() =>
                  void run(
                    () => requestG365ManualPosition(imei, 'wifi'),
                    'trackingPage.capActionManualWifiSent'
                  )
                }
              >
                {t('trackingPage.capActionManualWifi')}
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                disabled={busy || !commandsAvailable}
                onClick={() =>
                  void run(() => restartG365(imei), 'trackingPage.capActionRestartSent')
                }
              >
                {t('trackingPage.capActionRestart')}
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                disabled={busy || !commandsAvailable}
                onClick={() =>
                  void run(() => startG365Find(imei), 'trackingPage.devicePanelG365FindSent')
                }
              >
                {t('trackingPage.devicePanelG365Find')}
              </button>
            </div>
            <p className="pp-subtle pp-trackDeviceAdvanced__foot">{t('trackingPage.capG365AdvancedFoot')}</p>
          </fieldset>
        ) : null}

        {provider === 'gpspos' ? (
          <p className="pp-subtle pp-trackDeviceAdvanced__foot">{t('trackingPage.capGpsposAdvancedFoot')}</p>
        ) : null}
      </div>
    </details>
  );
}
