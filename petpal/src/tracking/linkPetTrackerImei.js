import { fetchDeviceMeta } from './deviceMetaClient';
import { isGpsposSyncAvailable, saveGpsposBatteryPlan, syncGpsposPosition } from './gpsposCommandClient';

/**
 * After the user saves a collar IMEI on My pets, pull cloud data and enable polling when applicable.
 * Safe to call for any provider — GPSPOS sync is attempted; TCP collars ignore failures.
 * @param {string} imei
 * @returns {Promise<{ ok: boolean, provider?: string|null, reason?: string }>}
 */
export async function linkPetTrackerImei(imei) {
  const id = String(imei || '').trim();
  if (!id) return { ok: false, reason: 'missing_imei' };
  if (!isGpsposSyncAvailable()) return { ok: false, reason: 'not_configured' };

  let provider = null;
  try {
    const meta = await fetchDeviceMeta(id);
    provider = meta?.provider ?? null;
  } catch {
    /* ignore */
  }

  if (provider === 'xexun' || provider === 'g365') {
    return { ok: true, provider };
  }

  try {
    const synced = await syncGpsposPosition(id);
    provider = synced?.device?.provider || synced?.position?.provider || 'gpspos';
    try {
      await saveGpsposBatteryPlan(id, { planId: 'balanced' });
    } catch {
      /* plan may already exist */
    }
    return { ok: true, provider };
  } catch (e) {
    if (e?.code === 'no_position' || e?.code === 'gpspos_disabled') {
      return { ok: true, provider: provider || null, reason: e.code };
    }
    throw e;
  }
}
