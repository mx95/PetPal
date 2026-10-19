const KNOWN_TYPES = ['zone_exit', 'zone_enter', 'battery_low', 'sos', 'offline'];

export const ALERT_ICONS = {
  zone_exit: '🚪',
  zone_enter: '🏡',
  battery_low: '🪫',
  sos: '🆘',
  offline: '📡',
};

/**
 * Localised title/body for an alert stored by the tracker server (type + params).
 * @param {(key: string, vars?: object) => string} t
 */
export function alertText(t, n) {
  const type = KNOWN_TYPES.includes(n.type) ? n.type : 'generic';
  const vars = { pet: n.petName || n.params?.pet || '', ...n.params };
  return {
    title: t(`alerts.${type}.title`, vars),
    body: t(`alerts.${type}.body`, vars),
  };
}
