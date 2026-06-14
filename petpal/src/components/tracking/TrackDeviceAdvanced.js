import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { restartG365 } from '../../tracking/g365CommandClient';
import { isTrackerCommandsAvailable } from '../../tracking/trackerCommandClient';

/**
 * Collapsed extra commands — no protocol dumps, actions only.
 * @param {{ imei: string, provider: 'g365'|'gpspos'|null, onStatus?: (msg: string) => void, onError?: (msg: string) => void }} props
 */
export default function TrackDeviceAdvanced({ imei, provider, onStatus, onError }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const commandsAvailable = isTrackerCommandsAvailable();

  if (provider !== 'g365') return null;

  async function runRestart() {
    if (!imei?.trim()) return;
    if (!commandsAvailable) {
      onError?.(t('trackingPage.devicePanelNoApi'));
      return;
    }
    setBusy(true);
    onError?.('');
    try {
      await restartG365(imei);
      onStatus?.(t('trackingPage.capActionRestartSent'));
    } catch (err) {
      onError?.(err?.message || t('trackingPage.devicePanelFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="pp-trackDeviceAdvanced">
      <summary className="pp-trackDeviceAdvanced__summary">{t('trackingPage.deviceAdvancedLegend')}</summary>
      <div className="pp-trackDeviceAdvanced__body">
        <div className="pp-trackDeviceG365Actions">
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            disabled={busy || !imei?.trim() || !commandsAvailable}
            onClick={() => void runRestart()}
          >
            {t('trackingPage.capActionRestart')}
          </button>
        </div>
      </div>
    </details>
  );
}
