/** Tracker type capabilities — used in Device tab advanced section. */

/** @typedef {{ id: string, labelKey: string, descKey?: string, inApp?: boolean, api?: string }} TrackerCapabilityItem */

/** @typedef {{ id: string, labelKey: string, descKey: string, connection: string, uplink: TrackerCapabilityItem[], downlink: TrackerCapabilityItem[], inAppActions: TrackerCapabilityItem[], notSupported: TrackerCapabilityItem[] }} TrackerCapabilityProfile */

/** @type {Record<'g365'|'gpspos', TrackerCapabilityProfile>} */
export const TRACKER_CAPABILITIES = {
  g365: {
    id: 'g365',
    labelKey: 'trackingPage.capG365Label',
    descKey: 'trackingPage.capG365Desc',
    connection: 'TCP 5003 (7878…0D0A)',
    uplink: [
      { id: 'login', labelKey: 'trackingPage.capG365Login' },
      { id: 'gps-online', labelKey: 'trackingPage.capG365GpsOnline' },
      { id: 'gps-offline', labelKey: 'trackingPage.capG365GpsOffline' },
      { id: 'status', labelKey: 'trackingPage.capG365Status' },
      { id: 'wifi-lbs', labelKey: 'trackingPage.capG365WifiLbs' },
      { id: 'heartbeat', labelKey: 'trackingPage.capG365Heartbeat' },
      { id: 'charging', labelKey: 'trackingPage.capG365Charging' },
    ],
    downlink: [
      { id: 'upload-interval', labelKey: 'trackingPage.capG365UploadInterval', inApp: true, api: 'POST /api/g365/commands/upload-interval' },
      { id: 'status-interval', labelKey: 'trackingPage.capG365StatusInterval', inApp: true, api: 'POST /api/g365/commands/status-interval' },
      { id: 'manual-position', labelKey: 'trackingPage.capG365ManualPosition', inApp: true, api: 'POST /api/g365/commands/manual-position' },
      { id: 'find', labelKey: 'trackingPage.capG365Find', inApp: true, api: 'POST /api/g365/commands/find' },
      { id: 'restart', labelKey: 'trackingPage.capG365Restart', inApp: true, api: 'POST /api/g365/commands/power' },
      { id: 'server-redirect', labelKey: 'trackingPage.capG365ServerRedirect', api: 'POST /api/g365/commands/server-redirect' },
      { id: 'prohibit-lbs', labelKey: 'trackingPage.capG365ProhibitLbs', api: 'POST /api/g365/commands/prohibit-lbs' },
      { id: 'overspeed', labelKey: 'trackingPage.capG365Overspeed', api: 'POST /api/g365/commands/overspeed' },
      { id: 'phone', labelKey: 'trackingPage.capG365Phone', api: 'POST /api/g365/commands/phone' },
      { id: 'raw', labelKey: 'trackingPage.capG365Raw', api: 'POST /api/g365/commands/raw' },
    ],
    inAppActions: [
      { id: 'manual-gps', labelKey: 'trackingPage.devicePanelG365Locate', inApp: true },
      { id: 'manual-wifi', labelKey: 'trackingPage.capActionManualWifi', inApp: true },
      { id: 'find', labelKey: 'trackingPage.devicePanelG365Find', inApp: true },
      { id: 'restart', labelKey: 'trackingPage.capActionRestart', inApp: true },
    ],
    notSupported: [
      { id: 'voice', labelKey: 'trackingPage.capG365NoVoice' },
      { id: 'ftp', labelKey: 'trackingPage.capG365NoFtp' },
      { id: 'whitelist', labelKey: 'trackingPage.capG365NoWhitelist' },
    ],
  },
  gpspos: {
    id: 'gpspos',
    labelKey: 'trackingPage.capGpsposLabel',
    descKey: 'trackingPage.capGpsposDesc',
    connection: 'gpspos.net cloud (HTTP poll)',
    uplink: [
      { id: 'cloud-gps', labelKey: 'trackingPage.capGpsposCloudGps' },
      { id: 'cloud-lbs', labelKey: 'trackingPage.capGpsposCloudLbs' },
      { id: 'battery', labelKey: 'trackingPage.capGpsposBattery' },
      { id: 'charging', labelKey: 'trackingPage.capGpsposCharging' },
    ],
    downlink: [
      { id: 'poll', labelKey: 'trackingPage.capGpsposPoll', inApp: true, api: 'Server poll + POST /api/gpspos/sync' },
      { id: 'history', labelKey: 'trackingPage.capGpsposHistory', api: 'POST /api/gpspos/sync/history' },
    ],
    inAppActions: [
      { id: 'sync', labelKey: 'trackingPage.devicePanelGpsposSync', inApp: true },
      { id: 'plan', labelKey: 'trackingPage.devicePanelGpsposApplyPlan', inApp: true },
    ],
    notSupported: [
      { id: 'tcp', labelKey: 'trackingPage.capGpsposNoTcp' },
      { id: 'ring', labelKey: 'trackingPage.capGpsposNoRing' },
      { id: 'live-cmd', labelKey: 'trackingPage.capGpsposNoLiveCmd' },
    ],
  },
};

/**
 * @param {string|null|undefined} provider
 * @returns {TrackerCapabilityProfile|null}
 */
export function getTrackerCapabilities(provider) {
  if (provider === 'g365' || provider === 'gpspos') return TRACKER_CAPABILITIES[provider];
  return null;
}
