import { resolveTrackerHttpBase } from './trackingWifiFeature';

/**
 * Public list of IMEIs known to the tracker server (registered in admin and/or checked in).
 * @returns {Promise<{ imei: string, provider: string|null, hasPosition: boolean }[]>}
 */
export async function fetchRegisteredTrackerDevices() {
  const base = resolveTrackerHttpBase();
  if (base == null) return [];
  const path = '/api/app/devices';
  const url = base === '' ? path : `${base}${path}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((row) => {
        const imei = String(row?.imei || '').trim();
        if (!imei) return null;
        const provider =
          row?.provider === 'g365' || row?.provider === 'gpspos' ? row.provider : null;
        const hasPosition = Boolean(
          row?.location?.lat != null ||
            row?.gps?.lat != null ||
            row?.last_lat != null
        );
        return { imei, provider, hasPosition };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function fetchRegisteredTrackerImeis() {
  const rows = await fetchRegisteredTrackerDevices();
  return rows.map((r) => r.imei);
}
