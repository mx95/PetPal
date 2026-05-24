const STORAGE_KEY = 'petpal_wifi_networks_v1';

/** @typedef {{ id: string, label: string, bssid: string }} WifiNetworkEntry */

/** @returns {Record<string, WifiNetworkEntry[]>} */
function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/** @param {string} imei @returns {WifiNetworkEntry[]} */
export function loadWifiNetworks(imei) {
  if (!imei) return [];
  const all = readAll();
  const list = all[imei];
  return Array.isArray(list) ? list : [];
}

/** @param {string} imei @param {WifiNetworkEntry[]} networks */
export function saveWifiNetworks(imei, networks) {
  if (!imei) return;
  const all = readAll();
  all[imei] = networks;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function newWifiNetworkEntry(label = '', bssid = '') {
  return {
    id: `wn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    bssid,
  };
}
