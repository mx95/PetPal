/**
 * Xexun tk= presets (p1 = location priority mode).
 * Other fields follow a common vendor default: tk=MODE,60,2,3600,0,0,20
 *
 * @typedef {{ id: string, label: string, p1: number, p2: number, p3: number, p4: number, p5: number, p6: number, p7: number }} TrackingModePreset
 */

/** @type {TrackingModePreset[]} */
export const TRACKING_MODE_PRESETS = [
  {
    id: 'wifi_priority',
    label: 'Wi‑Fi priority',
    p1: 3,
    p2: 60,
    p3: 2,
    p4: 3600,
    p5: 0,
    p6: 0,
    p7: 20,
  },
  {
    id: 'gps_priority',
    label: 'GPS priority',
    p1: 1,
    p2: 60,
    p3: 2,
    p4: 3600,
    p5: 0,
    p6: 0,
    p7: 20,
  },
  {
    id: 'gps_only',
    label: 'GPS only',
    p1: 2,
    p2: 60,
    p3: 2,
    p4: 3600,
    p5: 0,
    p6: 0,
    p7: 20,
  },
];

/** @param {string} id @returns {TrackingModePreset|undefined} */
export function getTrackingModePreset(id) {
  return TRACKING_MODE_PRESETS.find((p) => p.id === id);
}

/** @param {TrackingModePreset} preset */
export function presetToTkBody(preset) {
  return {
    p1: preset.p1,
    p2: preset.p2,
    p3: preset.p3,
    p4: preset.p4,
    p5: preset.p5,
    p6: preset.p6,
    p7: preset.p7,
  };
}
