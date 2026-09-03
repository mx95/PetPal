import { normalizeNotificationType } from './notificationTypes';

/**
 * @param {Array<{ id: string, title?: string, body?: string, createdAt?: string|null, createdBy?: string|null, createdByEmail?: string|null }>} broadcasts
 * @param {Array<{ id: string, title?: string, body?: string, type?: string, link?: string|null, createdAt?: string|null, readAt?: string|null, createdBy?: string|null, createdByEmail?: string|null }>} personal
 * @param {Set<string>} readIds
 */
export function mergeInboxMessages(broadcasts, personal, readIds) {
  const broadcastItems = (broadcasts || []).map((m) => ({
    id: m.id,
    source: 'broadcast',
    inboxKey: `broadcast:${m.id}`,
    title: String(m.title || '').trim(),
    body: String(m.body || '').trim(),
    type: 'announcement',
    link: null,
    createdAt: m.createdAt || null,
    createdBy: m.createdBy || null,
    createdByEmail: m.createdByEmail || null,
    read: readIds.has(m.id),
  }));

  const personalItems = (personal || []).map((m) => ({
    id: m.id,
    source: 'personal',
    inboxKey: `personal:${m.id}`,
    title: String(m.title || '').trim(),
    body: String(m.body || '').trim(),
    type: normalizeNotificationType(m.type),
    link: m.link ? String(m.link).trim() : null,
    createdAt: m.createdAt || null,
    createdBy: m.createdBy || null,
    createdByEmail: m.createdByEmail || null,
    read: Boolean(m.readAt),
  }));

  return [...broadcastItems, ...personalItems].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * @param {Array<{ read?: boolean }>} messages
 */
export function countUnreadInboxMessages(messages) {
  return (messages || []).filter((m) => !m.read).length;
}
