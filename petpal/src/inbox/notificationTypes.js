/** @typedef {'announcement' | 'admin' | 'booking' | 'order' | 'system'} NotificationType */

/** @type {Record<NotificationType, string>} */
export const NOTIFICATION_TYPE_ICONS = {
  announcement: '📬',
  admin: '🛡️',
  booking: '📅',
  order: '📦',
  system: '🔔',
};

/** @param {string} [type] */
export function normalizeNotificationType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'announcement' || t === 'admin' || t === 'booking' || t === 'order' || t === 'system') {
    return t;
  }
  return 'system';
}
