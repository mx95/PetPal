const LEGACY_DEVICE_KEY = 'petpal_traccar_device_id';

export function loadPetsJson(uid) {
  if (!uid) return '[]';
  try {
    return localStorage.getItem(`petpal_pets_${uid}`) || '[]';
  } catch {
    return '[]';
  }
}

export function savePetsJson(uid, jsonString) {
  if (!uid) return;
  try {
    localStorage.setItem(`petpal_pets_${uid}`, jsonString);
  } catch {
    // ignore
  }
}

export function readLegacyTraccarDeviceId() {
  try {
    return localStorage.getItem(LEGACY_DEVICE_KEY);
  } catch {
    return null;
  }
}

export function clearLegacyTraccarDeviceId() {
  try {
    localStorage.removeItem(LEGACY_DEVICE_KEY);
  } catch {
    // ignore
  }
}
