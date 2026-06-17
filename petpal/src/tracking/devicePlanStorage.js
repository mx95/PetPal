const STORAGE_KEY = 'petpal_device_plans_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} imei
 * @returns {{ planId: string, uploadSeconds: number, statusMinutes: number } | null}
 */
export function loadDevicePlan(imei) {
  const key = String(imei || '').trim();
  if (!key) return null;
  const row = readAll()[key];
  if (!row || typeof row !== 'object') return null;
  const planId = String(row.planId || '').trim();
  const uploadSeconds = Number(row.uploadSeconds);
  const statusMinutes = Number(row.statusMinutes);
  if (!planId || !Number.isFinite(uploadSeconds) || !Number.isFinite(statusMinutes)) return null;
  return { planId, uploadSeconds, statusMinutes };
}

/**
 * @param {string} imei
 * @param {{ planId: string, uploadSeconds: number, statusMinutes: number }} plan
 */
export function saveDevicePlan(imei, plan) {
  const key = String(imei || '').trim();
  if (!key || !plan?.planId) return;
  const map = readAll();
  map[key] = {
    planId: String(plan.planId),
    uploadSeconds: Number(plan.uploadSeconds),
    statusMinutes: Number(plan.statusMinutes),
  };
  writeAll(map);
}
