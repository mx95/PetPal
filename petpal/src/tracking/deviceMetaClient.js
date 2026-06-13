import { resolveTrackerHttpBase } from './trackingWifiFeature';

function normalizeProvider(value) {
  if (value === 'g365' || value === 'gpspos') return value;
  return null;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string} imei
 * @returns {Promise<{ provider: string|null, deviceConfig: object|null }|null>}
 */
export async function fetchDeviceMeta(imei) {
  const base = resolveTrackerHttpBase();
  if (!base || !imei?.trim()) return null;
  const path = `/api/app/devices/${encodeURIComponent(String(imei).trim())}`;
  const url = base === '' ? path : `${base}${path}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await readJsonSafe(res);
    return {
      provider:
        normalizeProvider(data?.provider) ||
        normalizeProvider(data?.deviceConfig?.providerOverride),
      deviceConfig: data?.deviceConfig ?? null,
    };
  } catch {
    return null;
  }
}

export { normalizeProvider };
