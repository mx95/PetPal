import { resolveTrackerHttpBase } from './trackingWifiFeature';

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function postG365(path, body) {
  const base = resolveTrackerHttpBase();
  if (base == null) {
    const err = new Error('TRACKER_API_NOT_CONFIGURED');
    err.code = 'TRACKER_API_NOT_CONFIGURED';
    throw err;
  }
  const url = base === '' ? path : `${base}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJsonSafe(res);
  if (!res.ok) {
    const code = data?.error ? String(data.error) : '';
    const err = new Error(code ? `365GPS API ${res.status} (${code})` : `365GPS API ${res.status}`);
    err.status = res.status;
    err.code = code || 'g365_api_error';
    throw err;
  }
  return data;
}

/** @param {string} imei @param {number} seconds 10–7200 */
export function setG365UploadInterval(imei, seconds) {
  return postG365('/api/g365/commands/upload-interval', { imei: String(imei).trim(), seconds });
}

/** @param {string} imei @param {number} minutes */
export function setG365StatusInterval(imei, minutes) {
  return postG365('/api/g365/commands/status-interval', { imei: String(imei).trim(), minutes });
}

/** @param {string} imei @param {'gps'|'wifi'} [mode] */
export function requestG365ManualPosition(imei, mode = 'gps') {
  return postG365('/api/g365/commands/manual-position', {
    imei: String(imei).trim(),
    mode: mode === 'wifi' ? 'wifi' : 'gps',
  });
}

/** @param {string} imei */
export function startG365Find(imei) {
  return postG365('/api/g365/commands/find', { imei: String(imei).trim(), start: true });
}

/** @param {string} imei */
export function restartG365(imei) {
  return postG365('/api/g365/commands/power', { imei: String(imei).trim(), operation: 'restart' });
}
